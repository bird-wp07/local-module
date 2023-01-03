FROM node:18.12.1-bullseye
RUN apt update -y && apt upgrade -y
RUN apt install -y curl zsh bash p7zip-full xz-utils default-jre

# Download and extract dss demo bundle. This is actually a windows bundle, but
# it contains shell scripts to start and stop the http server, which work well
# enough for our purpose. DSS uses port 8080 by default.
WORKDIR /root
RUN curl -Lo "./dss-demo-bundle-5.11.1.zip" "https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"
RUN 7z x -y "./dss-demo-bundle-5.11.1.zip" \
    && rm -r "./dss-demo-bundle-5.11.1/java"
EXPOSE 8080

# Download and extract portable node. This is used to run the local module and
# its tests inside a container of this image. For this the files have to be
# volume mapped into the container at startup.
RUN curl -Lo "node.tar.xz" "https://nodejs.org/dist/v18.12.1/node-v18.12.1-linux-x64.tar.xz"
RUN tar -xvf "node.tar.xz"
ENV PATH="/root/node-v18.12.1-linux-x64/bin:$PATH"

# Start DSS by default.
CMD bash ./dss-demo-bundle-5.11.1/apache-tomcat-8.5.82/bin/catalina.sh run