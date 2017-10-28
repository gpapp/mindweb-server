# Mindweb server

## How to start

### Create configuration
Create configuration file in config dir by copying 
the config/config-template.json to config/

### Create container
The mindweb server is supposed to run within a docker 
container on Linux.

To create a docker container set the environment variables
* SERVER_PORT - Where your docker will listen
* TYPE - The environment type (eg. DEV/LIVE)
* DB_PORT - Where your DB is mapped
* HTTP_PORT - Where the server is supposed to listen


