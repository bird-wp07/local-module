FROM amazoncorretto:19-alpine3.16
RUN apk add curl bash p7zip

# Download and extract dss demo bundle. This is actually a windows bundle, but
# it contains shell scripts to start and stop the http server, which work well
# enough for our purpose.
# After unpacking, we delete the embedded windows java runtime.
WORKDIR /root
RUN curl -Lo "./dss-demo-bundle-5.11.1.zip" "https://ec.europa.eu/digital-building-blocks/artifact/repository/esignaturedss/eu/europa/ec/joinup/sd-dss/dss-demo-bundle/5.11.1/dss-demo-bundle-5.11.1.zip"
RUN 7z x -y "./dss-demo-bundle-5.11.1.zip"
RUN rm -r "./dss-demo-bundle-5.11.1/java"

# Start dss server, runs on port 8080 by default.
EXPOSE 8080
CMD bash ./dss-demo-bundle-5.11.1/apache-tomcat-8.5.82/bin/catalina.sh run
