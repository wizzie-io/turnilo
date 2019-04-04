FROM node:6-slim

#RUN npm i -g turnilo@1.13.0 && \
RUN apt-get update && apt-get install -y git && \
    npm i -g git+https://github.com/wizzie-io/turnilo.git && \
    mkdir -p /etc/turnilo && \
    npm i js-yaml && \
    apt-get update && \
    apt-get install -y gettext-base
COPY docker/config.yaml_env /etc/turnilo/config.yaml_env

CMD envsubst < /etc/turnilo/config.yaml_env > /etc/turnilo/config.yaml && turnilo --config /etc/turnilo/config.yaml
