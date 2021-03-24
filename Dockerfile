FROM node:12

LABEL org.opencontainers.image.source https://github.com/splunk/fabric-logger

WORKDIR /usr/src/app
ENV NODE_ENV production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY . ./
RUN yarn build
RUN yarn link

ARG DOCKER_BUILD_GIT_COMMIT="n/a"
ENV FABRIC_LOGGER_GIT_COMMIT $DOCKER_BUILD_GIT_COMMIT

CMD [ "fabriclogger" ]
