import {validateRegistration,measurementContracts} from '../market-registration/metadata.mjs';
import {registrationHash as hash,verifyRegistrationPlanHash} from '../market-registration/planner.mjs';
import {registryMatches} from './preview.mjs';
const hex=s=>Buffer.from(s,'hex');
const requireValue=(ok,code='REGISTRATION_DB_CONTENT_CONFLICT')=>{if(!ok)throw Error(code);};
const stamp=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
export async function selectionContext(client,id){
 const r=(await client.query(`SELECT encode(s.id,'hex') AS id,encode(s.metadata_id,'hex') AS metadata_id,encode(s.source_hash,'hex') AS source_hash,${stamp('s.fetched_at')} AS fetched,
 s.document AS plan,m.document AS metadata,m.legacy_document AS legacy,m.contracts,encode(m.legacy_hash,'hex') AS legacy_hash,m.revision
 FROM atlas_registration.selection s JOIN atlas_registration.metadata_revision m ON m.id=s.metadata_id WHERE s.id=$1`,[hex(id)])).rows[0];
 requireValue(r,'REGISTRATION_DB_SELECTION_REQUIRED');
 validateRegistration(r.metadata,r.legacy);verifyRegistrationPlanHash(r.plan);
 requireValue(hash(r.metadata)===r.metadata_id&&hash(r.legacy)===r.legacy_hash&&r.revision===r.metadata.revision&&hash(r.contracts)===hash(measurementContracts)&&r.plan.planHash===r.id&&r.plan.metadataHash===r.metadata_id&&r.plan.legacyRegistryHash===r.legacy_hash&&r.plan.catalogueSource.hash===r.source_hash&&r.plan.catalogueSource.fetchedAt===r.fetched);
 return r;
}

export async function requireCurrentRegistrationSelection(client,selectionId){
 const latest=(await client.query(`SELECT encode(id,'hex') AS id FROM atlas_registration.selection
 WHERE metadata_id=(SELECT id FROM atlas_registration.metadata_revision ORDER BY revision DESC LIMIT 1)
 ORDER BY fetched_at DESC,id DESC LIMIT 1`)).rows[0];
 requireValue(latest?.id===selectionId,'REGISTRATION_DB_SELECTION_CHANGED');
 const c=await selectionContext(client,selectionId);await registryMatches(client,c.legacy);return c;
}
