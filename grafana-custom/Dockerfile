FROM grafana/grafana:12.2.1

USER root

COPY public /usr/share/grafana/public
COPY grafana.ini /etc/grafana/grafana.ini
COPY plugins /var/lib/grafana/plugins
COPY provisioning /etc/grafana/provisioning

RUN chown -R grafana:root /usr/share/grafana/public /etc/grafana/grafana.ini /var/lib/grafana/plugins /etc/grafana/provisioning

USER grafana
