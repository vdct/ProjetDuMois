FROM ubuntu:23.04

RUN apt -y update
RUN apt -y install osmium-tool python3

# Add the python script which will call osmupdate
ADD pbf_update.py /home/pbf_update.py

CMD ["python3", "-u", "/home/pbf_update.py"]
