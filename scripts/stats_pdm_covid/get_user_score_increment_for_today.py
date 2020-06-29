#!/usr/bin/env python
# coding: utf-8

import json
import datetime

init_file = "yesterday/covid.json"
current_file = "today/covid_to_check.json"

init_objects = []
current_objects = []

with open(init_file, 'r') as ifile:
    tt = json.load(ifile)
    init_objects = tt['features']

with open(current_file, 'r') as cfile:
    tt = json.load(cfile)
    current_objects = tt['features']

covid_tags_to_check = ["opening_hours:covid19", "delivery:covid19", "takeaway:covid19", "description:covid19", "access:covid19" ]

init_objects_ids = [elem["properties"]["@id"] for elem in init_objects]

for elem in current_objects:
    current_id = elem["properties"]["@id"]
    if current_id not in init_objects_ids:
        continue #faux positif dans l'extraction
    old_elem = [obj for obj in init_objects if obj["properties"]["@id"]==current_id][0]
    if elem["properties"]["@version"] == old_elem["properties"]["@version"]:
        continue #pas de modif sur cet objet
    for tag_to_check in covid_tags_to_check:
        if tag_to_check not in elem["properties"] and tag_to_check in old_elem["properties"]:
            ts = datetime.datetime.fromtimestamp(elem["properties"]["@timestamp"])
            print("{},{},rm_covid".format(elem["properties"]["@uid"], ts.isoformat()))


