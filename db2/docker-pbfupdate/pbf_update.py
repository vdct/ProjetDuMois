#!/usr/bin/env python
# -*- coding: UTF-8 -*-

import sys
from os import environ, listdir, mkdir, remove
from os.path import join, exists, abspath, isabs, isdir
from shutil import move
from subprocess import call
from sys import exit, stderr
from time import sleep


class PbfUpdater(object):

    def __init__(self):
        # Default values which can be overwritten by environment variable.
        self.default = {
            'RUNNER_PBFUPDATE_TIME': 60*60*3,
            'SETTINGS': 'settings',
            'IMPORT_RUNNERS': 'import_runners',
            'IMPORT_DONE': 'import_done',
            'RUNNER_NAME': 'pbfupdater',
        }
        self.osh_file = None
        self.import_dir = None


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
            self.import_dir = join(abspath(self.default['IMPORT_RUNNERS']), self.default['RUNNER_NAME'])
            self._create_runner_folders()

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

        # Check if OSH.PBF is available
        while self.osh_file is None:
            # Look in settings folder
            for f in listdir(self.default['SETTINGS']):
                if f.endswith('.osh.pbf') and not f.endswith('-new.osh.pbf'):
                    self.osh_file = join(self.default['SETTINGS'], f)

            if self.osh_file is None:
                self.info('OSH file *.pbf is not available in %s' % self.default['SETTINGS'])
                self.info('Sleeping for %s seconds.' % self.default['RUNNER_PBFUPDATE_TIME'])
                sleep(float(self.default['RUNNER_OSMUPDATE_TIME']))

        self.info('OSH PBF file: ' + self.osh_file)

        # In docker-compose, we should wait for the DB is ready.
        self.info('The checkup is OK.')


    def run(self):
        """First checker."""

        # Finally launch the listening process.
        while True:
            import_queue = sorted(listdir(self.import_dir))

            # Apply available diffs to OSH.PBF
            if len(import_queue) > 0:
                lastDiff = import_queue[len(import_queue)-1]
                self.info(f"Importing diffs up to {lastDiff}")
                self._update_osh_pbf(import_queue)

                # Moved processed diff to import_done folder
                for diff in import_queue:
                    move(
                        join(self.import_dir, diff),
                        join(self.default['IMPORT_DONE'], diff))

                # Update OSM.PBF based on updated OSH.PBF
                self._extract_osm_from_osh()

            self.info('Sleeping for %s seconds.' % self.default['RUNNER_PBFUPDATE_TIME'])
            sleep(float(self.default['RUNNER_PBFUPDATE_TIME']))


    def _create_runner_folders(self):
        """Creates import folders (if they don't exist yet) for this runner (based on its name)"""

        if not isdir(self.import_dir):
            try:
                mkdir(self.import_dir)
            except Exception as e:
                self.error("Can't create runner import dir: "+str(e))


    def _update_osh_pbf(self, args):
        # Command
        new_osh_file = self.osh_file.replace('.osh.pbf', '-new.osh.pbf')
        command = ['osmium', 'apply-changes', '-v', '--progress', '-H']
        command.append(self.osh_file)
        command.extend([ join(self.import_dir, p) for p in args ])
        command += ['-O', '-o']
        command.append(new_osh_file)

        self.info(command)
        if not call(command) == 0:
            self.error('Update of OSH.PBF file failed')
        else:
            remove(self.osh_file)
            move(new_osh_file, self.osh_file)
            self.info('OSH.PBF file successfully updated')


    def _extract_osm_from_osh(self):
        """Extracts the OSM.PBF file based on full-history OSH.PBF file"""

        # Command
        osm_file = self.osh_file.replace('.osh.pbf', '.osm.pbf')
        command = ['osmium', 'time-filter', '-v']
        command.append(self.osh_file)
        command += ['-O', '-o']
        command.append(osm_file)

        self.info(' '.join(command))
        if call(command) != 0 or not exists(osm_file):
            self.error("Can't extract latest OSM.PBF from OSH.PBF")
        else:
            self.info('Creating OSM.PBF successful : %s' % osm_file)


if __name__ == '__main__':
    updater = PbfUpdater()
    updater.overwrite_environment()
    updater.check_settings()
    updater.run()
