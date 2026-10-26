import {sourceReviewProfiles,sourceReviewDate,sourceReviewNotice,sourceFeaturesFor,sourceProfileKey} from '../web/source-review-data.js';
import {validateAssetReview} from '../web/asset-review-model.js';
// Reviewed public excerpts only. Explicit snapshot; never discover private source files.
export const reviewedAssetSnapshot=validateAssetReview({schemaVersion:1,kind:'REVIEWED_ASSET_PROFILES',id:'asset-source-review-20261025-v1',reviewedAt:sourceReviewDate,notice:sourceReviewNotice,
 profiles:sourceReviewProfiles.map(p=>({...p,features:sourceFeaturesFor(p.coinId,sourceProfileKey(p))}))});
