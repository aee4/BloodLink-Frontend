import assert from 'node:assert/strict';
import { request } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const evidence = new URL('../../artifacts/ui-parity/complete-makeover-deployment-2026-10-04/',import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('release-manifest.json',evidence),'utf8'));
const remote = JSON.parse(readFileSync(new URL('s3-after.json',evidence),'utf8').replace(/^\uFEFF/,''));
const objects = new Map(remote.Contents.map(o=>[o.Key,o]));
// AWS CLI aggregates pagination and may omit IsTruncated in its final output.
assert(remote.IsTruncated !== true && !remote.NextToken && !remote.NextContinuationToken,'S3 listing must include every deployed object');
assert.equal(objects.size,manifest.files.length,'Stale or missing S3 objects');
for(const file of manifest.files) {
    const object=objects.get(file.path);
    assert(object,'Missing deployed asset '+file.path);
    assert.equal(object.Size,file.size,file.path);
    assert.equal(object.ETag.replaceAll('"',''),file.md5,file.path);
}
const selected = manifest.files.filter(f=>(
    ['index.html','appsettings.json','app.css','favicon.svg','favicon.ico','favicon-16.png','favicon-32.png','manifest.webmanifest','BloodLink.Web.styles.css','_framework/blazor.boot.json','_framework/BloodLink.Web.wasm','_framework/blazor.webassembly.js'].includes(f.path)
    || /^css\//.test(f.path) || /^images\/(bloodlink-|product-)/.test(f.path) || /dotnet.*\.js$/.test(f.path)
));
const context=await request.newContext({baseURL:'https://d2z1pcfp95dfwd.cloudfront.net',extraHTTPHeaders:{'Cache-Control':'no-cache'}});
const results=[];
try {
    for(let i=0;i<selected.length;i+=4) await Promise.all(selected.slice(i,i+4).map(async file=>{
        const response=await context.get('/'+file.path);
        assert.equal(response.status(),200,file.path);
        const bytes=await response.body();
        const sha256=createHash('sha256').update(bytes).digest('hex');
        assert.equal(sha256,file.sha256,'Live bundle mismatch: '+file.path);
        if(['index.html','appsettings.json'].includes(file.path)) assert(response.headers()['cache-control'].includes('no-cache'));
        const csp=response.headers()['content-security-policy'];
        assert(csp && csp.includes("default-src 'self'") && csp.includes('https://wvsrmqrfc0.execute-api.eu-north-1.amazonaws.com'),'Production CSP changed');
        results.push({path:file.path,sha256,bytes:bytes.length,cacheControl:response.headers()['cache-control'],result:'matched'});
    }));
    console.log('PASS: '+manifest.files.length+' S3 asset checks and '+results.length+' live SHA-256 checks; no stale objects.');
} finally {
    writeFileSync(new URL('asset-verification.json',evidence),JSON.stringify({s3Objects:objects.size,releaseFiles:manifest.files.length,s3Result:'all MD5/size/key checks matched',live:results},null,2));
    await context.dispose();
}
