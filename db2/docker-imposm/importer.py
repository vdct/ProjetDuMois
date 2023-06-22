#!/usr/bin/env python
# -*- coding: UTF-8 -*-
"""
/***************************************************************************
                              Docker-OSM
                    An ImpOSM database up-to-date.
                        -------------------
        begin                : 2015-07-15
        email                : etienne at kartoza dot com
        contributor          : Etienne Trimaille
 ***************************************************************************/
/***************************************************************************
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 2 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 ***************************************************************************/
"""
import sys
from os import environ, listdir, mkdir
from os.path import join, exists, abspath, isabs, isdir
from shutil import move
from subprocess import call
from sys import exit, stderr
from time import sleep

from psycopg2 import connect, OperationalError


class Importer(object):

    def __init__(self):
        # Default values which can be overwritten by environment variable.
        self.default = {
            'RUNNER_IMPOSM_TIME': 120,
            'POSTGRES_USER': 'docker',
            'POSTGRES_PASS': 'docker',
            'POSTGRES_DBNAME': 'gis',
            'POSTGRES_HOST': 'db',
            'POSTGRES_PORT': '5432',
            'SETTINGS': 'settings',
            'CACHE': 'cache',
            'IMPORT_RUNNERS': 'import_runners',
            'IMPORT_DONE': 'import_done',
            'SRID': '4326',
            'OPTIMIZE': 'false',
            'RUNNER_NAME': None,
            'CLIP': 'yes',
            'SSL_MODE': 'disable',
            'SSL_CERT': None,
            'SSL_ROOT_CERT': None,
            'SSL_KEY': None,
            'DBSCHEMA_PREFIX': 'pdm',
        }
        self.osm_file = None
        self.mapping_file = None
        self.post_import_file = None
        self.clip_json_file = None
        self.cursor = None
        self.postgis_uri = None
        self.cache_dir = None
        self.import_dir = None
        self.dbschema_prod = None
        self.dbschema_import = None
        self.dbschema_backup = None
        self.settings_runner_dir = None

    @staticmethod
    def info(message):
        print(message)

    @staticmethod
    def error(message):
        stderr.write(message)
        print(message)
        exit()

    def overwrite_environment(self):
        """Overwrite default values from the environment."""
        for key in list(environ.keys()):
            if key in list(self.default.keys()):
                self.default[key] = environ[key]

    def check_settings(self):
        """Perform various checking.

        This will run when the container is starting. If an error occurs, the
        container will stop.
        """

        # Check if runner name is defined
        if self.default['RUNNER_NAME'] is None or len(self.default['RUNNER_NAME'].strip()) == 0:
            self.error("Runner name is not defined")
        else:
            self.info("Runner name: "+self.default['RUNNER_NAME'])
            self.cache_dir = join(self.default['CACHE'], self.default['RUNNER_NAME'])
            self.import_dir = join(self.default['IMPORT_RUNNERS'], self.default['RUNNER_NAME'])
            self.settings_runner_dir = join(self.default['SETTINGS'], 'runner_'+self.default['RUNNER_NAME'])
            self._create_runner_folders()
            self.dbschema_prod = '_'.join([self.default['DBSCHEMA_PREFIX'], self.default['RUNNER_NAME'], 'production'])
            self.dbschema_import = '_'.join([self.default['DBSCHEMA_PREFIX'], self.default['RUNNER_NAME'], 'import'])
            self.dbschema_backup = '_'.join([self.default['DBSCHEMA_PREFIX'], self.default['RUNNER_NAME'], 'backup'])

        # Check valid SRID.
        if self.default['SRID'] not in ['4326', '3857']:
            msg = 'SRID not supported : %s' % self.default['SRID']
            self.error(msg)
        else:
            self.info('Detect SRID: ' + self.default['SRID'])
            # Check valid CLIP.
        if self.default['CLIP'] not in ['yes', 'no']:
            msg = 'CLIP not supported : %s' % self.default['CLIP']
            self.error(msg)
        else:
            self.info('Clip: ' + self.default['CLIP'])

        # Check folders.
        folders = ['IMPORT_DONE', 'SETTINGS']
        for folder in folders:
            if not isabs(self.default[folder]):
                # Get the absolute path.
                self.default[folder] = abspath(self.default[folder])

            # Test the folder
            if not exists(self.default[folder]):
                msg = 'The folder %s does not exist.' % self.default[folder]
                self.error(msg)

        # Test files
        for f in listdir(self.default['SETTINGS']):

            if f.endswith('.osm.pbf'):
                self.osm_file = join(self.default['SETTINGS'], f)

            if f == 'post-pbf-import.sql':
                self.post_import_file = join(self.default['SETTINGS'], f)

            if f == 'clip.geojson':
                self.clip_json_file = join(self.default['SETTINGS'], f)

        for f in listdir(self.settings_runner_dir):

            if f.endswith('.yml'):
                self.mapping_file = join(self.settings_runner_dir, f)

        if not self.osm_file:
            msg = 'OSM file *.pbf is missing in %s' % self.default['SETTINGS']
            self.error(msg)
        else:
            self.info('OSM PBF file: ' + self.osm_file)

        if not self.mapping_file:
            msg = 'Mapping file *.yml is missing in %s' % self.default['SETTINGS']
            self.error(msg)
        else:
            self.info('Mapping: ' + self.osm_file)

        if not self.post_import_file:
            self.info('No custom SQL files post-pbf-import.sql detected in %s' % self.default['SETTINGS'])
        else:
            self.info('SQL Post Import: ' + self.post_import_file)
        if not self.clip_json_file:
            self.info('No json files to limit import detected in %s' % self.default['SETTINGS'])
        else:
            self.info('Geojson Initial Import Clip: ' + self.clip_json_file)

        if not self.clip_json_file and self.default['CLIP'] == 'yes':
            msg = 'clip.geojson is missing and CLIP = yes.'
            self.error(msg)
        elif self.clip_json_file:
            self.info('Geojson for clipping: ' + self.clip_json_file)
        else:
            self.info('No *.geojson detected, so no clipping.')

        # In docker-compose, we should wait for the DB is ready.
        self.info('The checkup is OK.')

    def create_timestamp(self):
        """Create the timestamp with the undefined value until the real one."""
        file_path = join(self.default['SETTINGS'], 'timestamp.txt')
        timestamp_file = open(file_path, 'w')
        timestamp_file.write('UNDEFINED\n')
        timestamp_file.close()

    def update_timestamp(self, database_timestamp):
        """Update the current timestamp of the database."""
        file_path = join(self.default['SETTINGS'], 'timestamp.txt')
        timestamp_file = open(file_path, 'w')
        timestamp_file.write('%s\n' % database_timestamp)
        timestamp_file.close()

    def check_postgis(self):
        """Test connection to PostGIS and create the URI."""
        if self.default['SSL_MODE'] == 'verify-ca' or self.default['SSL_MODE'] == 'verify-full':
            if self.default['SSL_CERT'] is None and self.default['SSL_KEY'] is None and self.default['SSL_ROOT_CERT'] \
                    is None:
                sys.exit()
            else:

                conn_parameters = "dbname='%s' user='%s' host='%s' port='%s' password='%s'" \
                                  " sslmode='%s' sslcert='%s' sslkey='%s' sslrootcert='%s' " % (
                                      self.default['POSTGRES_DBNAME'],
                                      self.default['POSTGRES_USER'],
                                      self.default['POSTGRES_HOST'],
                                      self.default['POSTGRES_PORT'],
                                      self.default['POSTGRES_PASS'],
                                      self.default['SSL_MODE'],
                                      self.default['SSL_CERT'],
                                      self.default['SSL_KEY'],
                                      self.default['SSL_ROOT_CERT'])
        else:
            conn_parameters = "dbname='%s' user='%s' host='%s' port='%s' password='%s' sslmode='%s'  " % (
                self.default['POSTGRES_DBNAME'],
                self.default['POSTGRES_USER'],
                self.default['POSTGRES_HOST'],
                self.default['POSTGRES_PORT'],
                self.default['POSTGRES_PASS'],
                self.default['SSL_MODE'])

        try:
            connection = connect(conn_parameters)
            self.cursor = connection.cursor()
        except OperationalError as e:
            self.error(e)

        if self.default['SSL_MODE'] == 'verify-ca' or self.default['SSL_MODE'] == 'verify-full':
            if self.default['SSL_CERT'] is None and self.default['SSL_KEY'] is None and self.default['SSL_ROOT_CERT'] \
                    is None:
                sys.exit()
            else:
                self.postgis_uri = \
                    'postgis://%s:%s@%s:%s/%s?sslmode=%s&sslcert=%s&sslkey=%s&sslrootcert=%s' % (
                        self.default['POSTGRES_USER'],
                        self.default['POSTGRES_PASS'],
                        self.default['POSTGRES_HOST'],
                        self.default['POSTGRES_PORT'],
                        self.default['POSTGRES_DBNAME'],
                        self.default['SSL_MODE'],
                        self.default['SSL_CERT'],
                        self.default['SSL_KEY'],
                        self.default['SSL_ROOT_CERT'])
        elif self.default['SSL_MODE'] == 'require' or self.default['SSL_MODE'] == 'prefer':
            self.postgis_uri = 'postgis://%s:%s@%s:%s/%s?sslmode=%s' \
                               % (
                                   self.default['POSTGRES_USER'],
                                   self.default['POSTGRES_PASS'],
                                   self.default['POSTGRES_HOST'],
                                   self.default['POSTGRES_PORT'],
                                   self.default['POSTGRES_DBNAME'],
                                   self.default['SSL_MODE'])
        else:
            self.postgis_uri = 'postgis://%s:%s@%s:%s/%s' % (
                self.default['POSTGRES_USER'],
                self.default['POSTGRES_PASS'],
                self.default['POSTGRES_HOST'],
                self.default['POSTGRES_PORT'],
                self.default['POSTGRES_DBNAME'])

    def import_custom_sql(self):
        """Import the custom SQL file into the database."""
        self.info('Running the post import SQL file.')
        command = ['psql']
        command += ['-h', self.default['POSTGRES_HOST']]
        command += ['-p', self.default['POSTGRES_PORT']]
        command += ['-U', self.default['POSTGRES_USER']]
        command += ['-d', self.default['POSTGRES_DBNAME']]
        command += ['-f', self.post_import_file]
        call(command)

    def locate_table(self, name, schema):
        """Check for tables in the DB table exists in the DB"""
        sql = """ SELECT EXISTS (SELECT 1 AS result from information_schema.tables
                 where table_name like  TEMP_TABLE and table_schema = 'TEMP_SCHEMA'); """
        self.cursor.execute(sql.replace('TEMP_TABLE', '%s' % name).replace('TEMP_SCHEMA', '%s' % schema))
        # noinspection PyUnboundLocalVariable
        return self.cursor.fetchone()[0]

    def run(self):
        """First checker."""

        osm_tables = self.locate_table("'osm_%'", self.dbschema_prod)

        if osm_tables != 1:
            # It means that the DB is empty. Let's import the PBF file.
            if self.clip_json_file:
                self._first_pbf_import(['-limitto', self.clip_json_file])
            else:
                self._first_pbf_import([])
        else:
            self.info(
                'The database is not empty. Let\'s import only diff files.')

        if self.default['RUNNER_IMPOSM_TIME'] != '0':
            if self.clip_json_file:
                self._import_diff(['-limitto', self.clip_json_file])
            else:
                self._import_diff([])
        else:
            self.info('No more update to the database. Leaving.')

    def _create_runner_folders(self):
        """Creates cache and import folders (if they don't exist yet) for this runner (based on its name)"""

        if not isdir(self.cache_dir):
            try:
                mkdir(self.cache_dir)
            except Exception as e:
                self.error("Can't create runner cache dir: "+str(e))

        if not isdir(self.import_dir):
            try:
                mkdir(self.import_dir)
            except Exception as e:
                self.error("Can't create runner import dir: "+str(e))

        if not isdir(self.settings_runner_dir):
            self.error(f"Runner settings dir {str(self.settings_runner_dir)} doesn't exist")

    def _first_pbf_import(self, args):
        """Run the first PBF import into the database."""
        command = ['imposm', 'import', '-diff', '-deployproduction']
        command += ['-overwritecache', '-cachedir', self.cache_dir]
        command += ['-srid', self.default['SRID']]
        command += ['-dbschema-production', self.dbschema_prod]
        command += ['-dbschema-import', self.dbschema_import]
        command += ['-dbschema-backup', self.dbschema_backup]
        command += ['-diffdir', self.default['SETTINGS']]
        command += ['-mapping', self.mapping_file]
        command += ['-read', self.osm_file]
        command += ['-write', '-connection', self.postgis_uri]
        self.info('The database is empty. Let\'s import the PBF : %s' % self.osm_file)

        command.extend(args)
        self.info(command)
        if not call(command) == 0:
            msg = 'An error occured in imposm with the original file.'
            self.error(msg)
        else:
            self.info('Import PBF successful : %s' % self.osm_file)

        if self.post_import_file:
            # Set the password for psql
            environ['PGPASSWORD'] = self.default['POSTGRES_PASS']

        if self.post_import_file:
            self.import_custom_sql()

    def _import_diff(self, args):
        # Finally launch the listening process.
        while True:
            import_queue = sorted(listdir(self.import_dir))
            if len(import_queue) > 0:
                for diff in import_queue:
                    self.info('Importing diff %s' % diff)
                    command = ['imposm', 'diff']
                    command += ['-cachedir', self.cache_dir]
                    command += ['-dbschema-production', self.dbschema_prod]
                    command += ['-dbschema-import', self.dbschema_import]
                    command += ['-dbschema-backup', self.dbschema_backup]
                    command += ['-srid', self.default['SRID']]
                    command += ['-diffdir', self.default['SETTINGS']]
                    command += ['-mapping', self.mapping_file]
                    command += ['-connection', self.postgis_uri]
                    command.extend(args)
                    command += [join(self.import_dir, diff)]

                    self.info(command)
                    if call(command) == 0:
                        move(
                            join(self.import_dir, diff),
                            join(self.default['IMPORT_DONE'], diff))

                        # Update the timestamp in the file.
                        database_timestamp = diff.split('.')[0].split('->-')[1]
                        self.update_timestamp(database_timestamp)
                    else:
                        msg = 'An error occured in imposm with a diff.'
                        self.error(msg)

            if len(listdir(self.import_dir)) == 0:
                self.info('Sleeping for %s seconds.' % self.default['RUNNER_IMPOSM_TIME'])
                sleep(float(self.default['RUNNER_IMPOSM_TIME']))


if __name__ == '__main__':
    importer = Importer()
    importer.overwrite_environment()
    importer.check_settings()
    importer.create_timestamp()
    importer.check_postgis()
    importer.run()
