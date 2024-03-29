# Dockerfile used to build images for development and self-contained testing.

FROM ubuntu:latest
RUN apt update -y --fix-missing && apt upgrade -y
RUN apt install -y curl zsh bash xz-utils jq p7zip-full
WORKDIR /root
ADD ./start.sh /root/start.sh

# Envvars used inside start.sh to set the installation output
# directories for each dependency.
ENV JDK_ROOT=jdk
ENV DSS_ROOT=dss
ENV NODE_ROOT=node
ENV LM_ROOT=local-module

# Install Java
RUN ./start.sh install_jdk "$JDK_ROOT"
ENV JAVA_HOME="/root/$JDK_ROOT"
ENV PATH="$JAVA_HOME/bin:$PATH"

# Install DSS
RUN ./start.sh install_dss "$DSS_ROOT"

# Install Node
RUN ./start.sh install_node "$NODE_ROOT"
ENV PATH="/root/$NODE_ROOT/bin:$PATH"

# Install local module
RUN ./start.sh install_lm "$LM_ROOT"

# Ports must match those used in start.sh
EXPOSE 2048
EXPOSE 8089
CMD bash
