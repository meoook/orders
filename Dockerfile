FROM node:16.4.2

RUN echo "deb http://ftp.us.debian.org/debian unstable main contrib non-free" > /etc/apt/sources.list.d/unstable.list \
  && apt-get update
RUN apt-get install --assume-yes -t unstable libgmp3-dev

# RUN apt-get install gcc libffi-dev

RUN mkdir -p /opt/cryptocurrency-pool-server

COPY package.json /opt/cryptocurrency-pool-server/
COPY package-lock.json /opt/cryptocurrency-pool-server/

WORKDIR /opt/cryptocurrency-pool-server

RUN npm install && echo 4

COPY . /opt/cryptocurrency-pool-server/

RUN rm -rf /opt/cryptocurrency-pool-server/pool_configs
RUN ln -s /opt/config/config.json /opt/cryptocurrency-pool-server/config.json
RUN ln -s /opt/config/pool_configs /opt/cryptocurrency-pool-server/

VOLUME ["/opt/config"]

EXPOSE 80
EXPOSE 3333

CMD node init.js
