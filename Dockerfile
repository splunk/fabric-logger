FROM node:8

WORKDIR /usr/src/app
ENV NODE_ENV production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY . ./
RUN yarn build

CMD [ "node", "dist/main.js" ]
