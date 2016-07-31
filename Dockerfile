From node:latest


USER root
RUN useradd node
RUN mkdir /home/node
RUN mkdir /home/node/config
RUN chown node /home/node

WORKDIR /home/node
ADD . /home/node
RUN chown -R node /home/node
EXPOSE 8081

CMD []
ENTRYPOINT ["/home/node/bin/startup.sh"]
