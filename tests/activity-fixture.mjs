import {activityAssets,activityHash} from '../tools/activity-source.mjs';
export function activityFixture({queriedAt='2026-10-23T00:00:00.000000Z',amount='1000.000000000000000001',day='2026-10-21',adjusted=null,coin='usdc'}={}){
 const row={coin_id:coin,chain:'ethereum',token_address:activityAssets[coin],activity_date:day+'T00:00:00',transfer_volume_str:amount,transfer_volume_usd_str:'999.95',transfer_count_str:'2',transfer_tx_count_str:'1',has_adjusted_volume:true,adjusted_volume_usd_str:adjusted};
 const data={sql:'SELECT reviewed_private_fixture',data:[row],meta:{row_count:1,run_id:'private-run-not-for-web'},queried_at:queriedAt};const bytes=Buffer.from(JSON.stringify(data));return {data,bytes,options:{expectedHash:activityHash(bytes),from:'2026-10-08',to:'2026-10-22',now:'2026-10-24T00:00:00.000Z'}};
}
