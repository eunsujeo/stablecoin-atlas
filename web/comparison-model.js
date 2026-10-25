import {sourceReviewProfiles, sourceFeaturesFor, sourceProfileKey} from './source-review-data.js';

// Scoped feature ids are local to each profile (e.g. scope-0); never join on them.
export function sourceComparison(ids) {
  if (ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length) throw Error('SELECT_DISTINCT_PROFILES');
  const profiles = ids.map(id => sourceReviewProfiles.find(profile => profile.id === id));
  if (profiles.some(profile => !profile)) throw Error('UNKNOWN_PROFILE');
  const features = profiles.map(profile => sourceFeaturesFor(profile.coinId, sourceProfileKey(profile)));
  const key = feature => JSON.stringify([feature.group, feature.label]);
  const catalog = new Map(features.flat().map(feature => [key(feature), feature]));
  return {profiles, rows:[...catalog].map(([id, feature]) => ({id, label:feature.label, group:feature.group, cells:features.map(list => list.filter(item => key(item) === id))}))};
}
