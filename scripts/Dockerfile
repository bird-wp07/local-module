FROM ubuntu:latest
RUN apt update -y && apt upgrade -y
RUN apt install -y curl zsh bash xz-utils jq
WORKDIR /root
ADD ./bootstrap-linux.sh /root/bootstrap-linux.sh

# Envvars used inside bootstrap-linux.sh to set the installation output
# directories for each dependency.
ENV JDK_ROOT=jdk-puu
ENV DSS_ROOT=dss-puu
ENV NODE_ROOT=node-puu
ENV LM_ROOT=local-module-puu

# Install Java
RUN ./bootstrap-linux.sh install_jdk "$JDK_ROOT"
ENV JAVA_HOME="/root/$JDK_ROOT"
ENV PATH="$JAVA_HOME/bin:$PATH"

# Install DSS
RUN ./bootstrap-linux.sh install_dss "$DSS_ROOT"

# Install Node
RUN ./bootstrap-linux.sh install_node "$NODE_ROOT"
ENV PATH="/root/$NODE_ROOT/bin:$PATH"

# Install local module
RUN ./bootstrap-linux.sh install_lm "$LM_ROOT"

EXPOSE 2048
EXPOSE 8080
CMD bash
