FROM nginx:1.29-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY shared /usr/share/nginx/html/shared
COPY tabs /usr/share/nginx/html/tabs
COPY product /usr/share/nginx/html/product

COPY deploy/nginx/conf.d /etc/nginx/conf.d
COPY deploy/nginx/templates/env.conf.template /etc/nginx/templates/env.conf.template

ENV NGINX_ENVSUBST_FILTER="^env$"
ENV env=dev

RUN /bin/cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && echo 'Asia/Shanghai' > /etc/timezone
EXPOSE 80/TCP
