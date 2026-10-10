/** @OnlyCurrentDoc */
// I-011 consolidated regression entrypoint for OpsMate TEST.
// This file does not alter runtime behaviour. It only executes deterministic
// harnesses already defined in the TEST source tree.

const BSE_I011_HARNESSES=[
  'runBseInventoryD038AcceptanceHarnessTests',
  'runBseClaimD039D046AcceptanceHarnessTests',
  'runBseRouterD047HarnessTests',
  'runBseMultiRecordD048ApprovalHarnessTests',
  'runBseEvidenceDomainLinkD044HarnessTests',
  'runBseEvidenceWriterIntegrationD044HarnessTests',
  'runBseAssetD040AcceptanceHarnessTests',
  'runBseAssetApprovalD040HarnessTests',
  'runBseLeaveD041AcceptanceHarnessTests',
  'runBseLeaveApprovalD041HarnessTests',
  'runBseMaintenanceD042AcceptanceHarnessTests',
  'runBseMaintenanceApprovalD042HarnessTests',
  'runBseTreatmentD043AcceptanceHarnessTests',
  'runBseTreatmentRouterD043HarnessTests',
  'runBsePlantConditionD045AcceptanceHarnessTests',
  'runBsePlantConditionRouterD045HarnessTests',
  'runBsePlantConditionApprovalD045HarnessTests'
];

const BSE_I011_LEGACY_GUARDS=[
  'runBseAdditiveHeaderHarnessTests',
  'runBseOwnerRegistryHarnessTests',
  'runBseInventoryClaimFoundationHarnessTests',
  'runBseInventoryQuantityParserRegressionHarnessTests',
  'runBseTelegramCorrectionInventoryHarnessTests',
  'runBseTelegramSeedSowingBoundaryRegressionTests',
  'runBseCropBatchApprovalPresentationHarnessTests',
  'runBseTelegramQueueStatusRegressionTests',
  'runBseTelegramEvidenceHarnessTests',
  'runBseTreatmentReviewHarnessTests',
  'runBseEnvironmentIsolationHarnessTests'
];

function bseI011RunHarness_(name){
  const fn=this[name];
  if(typeof fn!=='function')return {name:name,status:'MISSING',error:'Function not found'};
  try{
    const value=fn();
    return {name:name,status:'PASS',result:value};
  }catch(error){
    return {name:name,status:'FAIL',error:String(error&&error.message||error)};
  }
}

function runBseI011FullRegression(){
  const started=new Date().toISOString(),results=[];
  BSE_I011_HARNESSES.concat(BSE_I011_LEGACY_GUARDS).forEach(name=>results.push(bseI011RunHarness_(name)));
  const failed=results.filter(row=>row.status!=='PASS');
  const summary={
    started_at:started,finished_at:new Date().toISOString(),
    total:results.length,passed:results.length-failed.length,failed:failed.length,
    production_write:false,results:results
  };
  console.log('BSE_I011_FULL_REGRESSION '+JSON.stringify(summary));
  if(failed.length)throw new Error('I-011 regression gagal: '+failed.map(row=>row.name+': '+row.status+(row.error?' ('+row.error+')':'')).join('; '));
  return summary;
}

function runBseI011ImplementationOnly(){
  const results=BSE_I011_HARNESSES.map(name=>bseI011RunHarness_(name));
  const failed=results.filter(row=>row.status!=='PASS');
  const summary={total:results.length,passed:results.length-failed.length,failed:failed.length,production_write:false,results:results};
  console.log('BSE_I011_IMPLEMENTATION_ONLY '+JSON.stringify(summary));
  if(failed.length)throw new Error('I-011 implementation harness gagal: '+failed.map(row=>row.name).join(', '));
  return summary;
}
