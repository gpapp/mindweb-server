# Mindweb server

## How to start

### Create configuration
Create configuration file in config dir by copying 
the config/config-template.json to config/config.json. 

Add your API keys to the config.json file. You may omit any of the service providers, 
however they will still show on the UI and will fail when you try to use them. 

Remove all the comments in the config/config.json file.

### Run locally
You will need a working Docker container and internet connection 
to start the server up.

Start the complementary servers, cassandra and kafka using 
the provided scripts or equivalents in your environment.

Set up the environment variables to point at your local 
server components 
```bash
export DB_HOST=localhost
export KAFKA_HOST=localhost
```

Start the server using `npm start` and cross your fingers.

### Create container
Please use the [docker project](https://github.com/gpapp/mindweb-docker) to create your environment! 
