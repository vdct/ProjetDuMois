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

from datetime import datetime, timezone
from os import listdir, environ, remove, scandir
from os.path import exists, join, isabs, abspath, getmtime
from subprocess import call, Popen, PIPE
from sys import exit, stderr
from shutil import copyfile, move
from time import sleep


class Downloader(object):

    def __init__(self):
        # Default values which can be overwritten.
        self.default = {
            'MAX_DAYS': '100',
            'DIFF': 'sporadic',
            'MAX_MERGE': '7',
            'COMPRESSION_LEVEL': '1',
            'BASE_URL': 'http://planet.openstreetmap.org/replication/',
            'IMPORT_QUEUE': 'import_queue',
            'IMPORT_RUNNERS': 'import_runners',
            'IMPORT_DONE': 'import_done',
            'SETTINGS': 'settings',
            'RUNNER_OSMUPDATE_TIME': 120,
        }
        self.osm_file = None
        self.osh_file = None

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

        if self.default['RUNNER_OSMUPDATE_TIME'] == '0':
            self.info('No more update to the database. Leaving.')
            quit()

    def check_settings(self):
        """Perform various checking."""
        # Folders
        folders = ['IMPORT_QUEUE', 'IMPORT_RUNNERS', 'IMPORT_DONE', 'SETTINGS']
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
            if f.endswith('.osh.pbf') and not f.endswith('-ts.osh.pbf'):
                self.osh_file = join(self.default['SETTINGS'], f)

        while self.osh_file is None or not exists(self.osh_file):
            sleep(float(self.default['RUNNER_OSMUPDATE_TIME']))

        self._check_latest_timestamp()

        while self.osm_file is None or not exists(self.osm_file):
            self.info('Extracting OSM file from OSH')
            self._extract_osm_from_osh()

        self.info('The checkup is OK.')

    def _extract_osm_from_osh(self):
        """Extracts the OSM.PBF file based on full-history OSH.PBF file"""

        # Command
        osm_file = self.osh_file.replace('.osh.pbf', '.osm.pbf')
        #osmium time-filter "${OSH_UPDATED}" -O -o "${OSM_PBF_NOW}"
        command = ['osmium', 'time-filter', '-v']
        command.append(self.osh_file)
        command += ['-O', '-o']
        command.append(osm_file)

        self.info(' '.join(command))
        if call(command) != 0 or not exists(osm_file):
            self.info('An error occured in osmium. Trying again in %s seconds.' % self.default['RUNNER_OSMUPDATE_TIME'])
            sleep(float(self.default['RUNNER_OSMUPDATE_TIME']))
        else:
            self.osm_file = osm_file
            self.info('Creating OSM.PBF successful : %s' % self.osm_file)


    def _check_latest_timestamp(self):
        """Fetch the latest timestamp."""
        # Check if diff to be imported is empty. If not, take the latest diff.
        diff_to_be_imported = sorted(listdir(self.default['IMPORT_QUEUE']))
        if len(diff_to_be_imported):
            file_name = diff_to_be_imported[-1].split('.')[0]
            timestamp = file_name.split('->-')[1]
            self.info('Timestamp from the latest not imported diff : %s' % timestamp)
        else:
            # Check if imported diff is empty. If not, take the latest diff.
            imported_diff = sorted(listdir(self.default['IMPORT_DONE']))
            if len(imported_diff):
                file_name = imported_diff[-1].split('.')[0]
                timestamp = file_name.split('->-')[1]
                self.info('Timestamp from the latest imported diff : %s' % timestamp)

            else:
                # Take the timestamp from original file.
                command = ['osmconvert', self.osh_file, '--out-timestamp']
                processus = Popen(
                    command, stdin=PIPE, stdout=PIPE, stderr=PIPE)
                timestamp, err = processus.communicate()

                try:
                    # Removing some \ in the timestamp.
                    try:
                        timestamp = timestamp.decode("utf-8").replace('\\', '')
                    except AttributeError:
                        timestamp = timestamp.replace('\\', '')

                    timestamp = timestamp.strip() # Remove new line
                    self.info(timestamp)
                    datetime.fromisoformat(timestamp)
                    self.info('Timestamp from the original state file : %s' % timestamp)

                except Exception as e:
                    self.info(f"Can't read timestamp {str(timestamp)} from input file: {str(e)}")
                    self.info("Setting timestamp to 10 days back")

                    # Command
                    osh2 = self.osh_file.replace(".osh.pbf", "-ts.osh.pbf")
                    command = ['osmconvert', '-v']
                    command += ['-o='+osh2]
                    command += ['--timestamp=NOW-864000']
                    command.append(self.osh_file)

                    self.info(' '.join(command))
                    if call(command) != 0:
                        self.error('An error occured when setting timestamp to OSH.PBF')
                    else:
                        remove(self.osh_file)
                        move(osh2, self.osh_file)
                        return self._check_latest_timestamp()

        return timestamp

    def download(self):
        """Infinite loop to download diff files on a regular interval."""
        while True:
            timestamp = self._check_latest_timestamp()

            # Save time
            current_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            self.info('Old time     : %s' % timestamp)
            self.info('Current time : %s' % current_time)

            # Destination
            file_name = '%s->-%s.osc.gz' % (timestamp, current_time)
            file_path = join(self.default['IMPORT_QUEUE'], file_name)

            # Command
            command = ['osmupdate', '-v']
            command += ['--max-days=' + self.default['MAX_DAYS']]
            #command += ['--' + self.default['DIFF']]
            command += ['--max-merge=' + self.default['MAX_MERGE']]
            command += ['--compression-level=' + self.default['COMPRESSION_LEVEL']]
            command += ['--base-url=' + self.default['BASE_URL']]
            command += ['-B=' + join(self.default['SETTINGS'], 'clip.poly')]
            command.append(timestamp)
            command.append(file_path)

            self.info(' '.join(command))
            if call(command) != 0:
                self.info('An error occured in osmupdate. Let\'s try again.')
                # Sleep less.
                self.info('Sleeping for 2 seconds.')
                sleep(2.0)
            else:
                self.info('Creating diff successful : %s' % file_name)

                # Push the new diff to runners
                runners_path = self.default['IMPORT_RUNNERS']
                runners_path_current = [ f.path for f in scandir(runners_path) if f.is_dir() ]
                if len(runners_path_current) == 0:
                    self.info("No diff runners currently")
                else:
                    self.info(f"Sending to runners: {', '.join(runners_path_current)}")

                # TODO : send all files in queue to runners
                for r_path in runners_path_current:
                    try:
                        copyfile(file_path, join(r_path, file_name))
                    except Exception as e:
                        self.error(f"Can't send diff {file_name} to runner {r_path}: {str(e)}")

                # Everything was fine, let's sleeping.
                self.info('Sleeping for %s seconds.' % self.default['RUNNER_OSMUPDATE_TIME'])
                sleep(float(self.default['RUNNER_OSMUPDATE_TIME']))


if __name__ == '__main__':
    downloader = Downloader()
    downloader.overwrite_environment()
    downloader.check_settings()
    downloader.download()
