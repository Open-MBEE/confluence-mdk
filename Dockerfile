FROM node:14-alpine

ARG confluence_user=anonymous
ARG confluence_pass=anonymous
ARG confluence_server=https://wiki.xyz.com

ENV CONFLUENCE_USER $confluence_user
ENV CONFLUENCE_PASS $confluence_pass
ENV CONFLUENCE_SERVER $confluence_server

COPY . /app
WORKDIR /app
RUN npm install
RUN npm link

ENTRYPOINT ["confluence-mdk"]
