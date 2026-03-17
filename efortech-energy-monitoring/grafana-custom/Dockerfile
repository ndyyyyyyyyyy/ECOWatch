FROM grafana/grafana:12.2.1

USER root

COPY public /usr/share/grafana/public
COPY grafana.ini /etc/grafana/grafana.ini
COPY plugins /var/lib/grafana/plugins

RUN chown -R grafana:root /usr/share/grafana/public /etc/grafana/grafana.ini /var/lib/grafana/plugins

USER grafana
