#!/usr/bin/bash
# Operator-run after CI success. Uses the existing verified Bootstrap install path.
set -euo pipefail
umask 077
export PATH=/usr/bin:/bin
unset NODE_OPTIONS NODE_PATH NODE_TLS_REJECT_UNAUTHORIZED
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo in your Mac mini terminal.' >&2; exit 1; }
atlas_done=/usr/local/libexec/atlas-maintenance/yahoo-fx.done
if [[ -f "$atlas_done" ]]; then echo YAHOO_FX_ALREADY_FINISHED; exit 0; fi
atlas_sha=6451918157ee53a7181fa439de875d09dc594afd
atlas_config=/root/atlas-yahoo-bootstrap-${atlas_sha}.json
atlas_code=/usr/local/lib/atlas-deploy
atlas_seed=/home/mob/atlas-fx-prepared-20261107/yahoo-fx-store
atlas_store=/var/lib/atlas-collector/yahoo-fx-store
# No service/data/config secrets are printed.
[[ -d "$atlas_seed" && ! -L "$atlas_seed" ]]
echo '1/5 Update Bootstrap via its existing immutable release installer.'
/usr/local/sbin/atlas-deploy-admin disable --config /etc/atlas-deploy/config.json
/usr/bin/node /usr/local/libexec/atlas-maintenance/maintenance-idle.mjs
if [[ ! -e "$atlas_config" ]]; then
 /usr/bin/node --use-env-proxy "$atlas_code/tools/deploy/local-config.mjs" "$atlas_sha" "$atlas_config"
fi
/usr/local/sbin/atlas-deploy-admin install --config "$atlas_config"
echo '2/5 Validate and publish the already collected Yahoo snapshot (no provider request).'
if [[ ! -e "$atlas_store" ]]; then
 atlas_temp=$(/usr/bin/mktemp -d /var/lib/atlas-collector/.yahoo-seed.XXXXXXXX)
 /usr/bin/cp -a -- "$atlas_seed/." "$atlas_temp/"
 # Only the newly created seed tree changes ownership; existing directories stay intact.
 /usr/bin/chown -hR atlascollector:atlascollector "$atlas_temp"
 /usr/sbin/runuser -u atlascollector -- /usr/bin/node --input-type=module - "$atlas_code" "$atlas_temp" <<'JS'
const [code,root]=process.argv.slice(2);
const {storedYahooInputs}=await import(code+'/tools/yahoo-fx-store.mjs');
const inputs=await storedYahooInputs(root);
if(inputs.length!==1||inputs[0].payload.sourceHash!=='f0e3b97a8fbe9f8c082d79330a0922fb53fbf905e84866c742b1c0690c6f1b0d')throw Error('SEED_HASH_MISMATCH');
console.log('YAHOO_SEED_VERIFIED');
JS
 /usr/bin/mv -nT -- "$atlas_temp" "$atlas_store"
 [[ ! -e "$atlas_temp" ]] || { echo 'Seed destination already exists; preserved both trees.' >&2; exit 1; }
fi
/usr/sbin/runuser -u atlascollector -g atlasweb -- /usr/bin/node "$atlas_code/tools/yahoo-fx-store.mjs" publish "$atlas_store" /var/lib/atlas-public/yahoo-fx.json
echo '3/5 Verify Bootstrap and existing database reader health.'
/usr/local/sbin/atlas-deploy-admin verify --config /etc/atlas-deploy/config.json
echo '4/5 Install the reviewed daily Yahoo units without touching Collector/Usage services.'
/usr/bin/systemd-analyze verify "$atlas_code/deploy/atlas-yahoo-fx.service" "$atlas_code/deploy/atlas-yahoo-fx.timer"
for atlas_unit in atlas-yahoo-fx.service atlas-yahoo-fx.timer; do
 if [[ -e /etc/systemd/system/$atlas_unit ]]; then
  /usr/bin/cmp -- "$atlas_code/deploy/$atlas_unit" "/etc/systemd/system/$atlas_unit"
 else
  /usr/bin/install -o root -g root -m 0644 -- "$atlas_code/deploy/$atlas_unit" "/etc/systemd/system/$atlas_unit"
 fi
done
/usr/bin/systemctl daemon-reload
echo '5/5 Restore deployment automation and switch only the FX timer.'
/usr/local/sbin/atlas-deploy-admin enable --config /etc/atlas-deploy/config.json
/usr/bin/systemctl enable --now atlas-yahoo-fx.timer
/usr/bin/systemctl disable --now atlas-fx.timer
/usr/bin/systemctl is-active atlas-yahoo-fx.timer atlas-deploy-agent.timer atlas-web.service atlas-collector.service
printf '%s\n' "$atlas_sha" > "$atlas_done"
echo 'YAHOO_BOOTSTRAP_READY: web release activation still follows the normal Git deployment path.'
