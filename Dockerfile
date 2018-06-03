FROM node:9
ENV WITH_SASL 0
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=8000
EXPOSE ${PORT}

CMD [ "npm", "start" ]
