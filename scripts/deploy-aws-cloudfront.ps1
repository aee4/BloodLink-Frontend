[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$region = 'eu-north-1'
$expectedArn = 'arn:aws:iam::589159458931:user/bloodlink-deployer'
$stackName = 'bloodlink-frontend-prod'
$repoRoot = Split-Path -Parent $PSScriptRoot
$templatePath = Join-Path $repoRoot 'infra/cloudformation/frontend.yml'
$projectPath = Join-Path $repoRoot 'src/BloodLink.Web/BloodLink.Web.csproj'
$publishPath = Join-Path $repoRoot 'src/BloodLink.Web/bin/Release/net8.0/publish/wwwroot'

function Invoke-AwsJson([string[]] $Arguments) {
    $result = & aws @Arguments --output json
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI command failed (exit $LASTEXITCODE). See sanitized AWS CLI error above." }
    return $result | ConvertFrom-Json
}

$identity = Invoke-AwsJson @('sts', 'get-caller-identity', '--region', $region)
if ($identity.Arn -ne $expectedArn) { throw 'AWS identity does not match the approved bloodlink-deployer IAM user.' }
$activeRegion = (& aws configure get region 2>$null).Trim()
if ($activeRegion -ne $region) { throw "Configured AWS region is '$activeRegion'; expected '$region'. Set it explicitly before deployment." }

dotnet publish $projectPath --configuration Release
if ($LASTEXITCODE -ne 0) { throw "Release publish failed (exit $LASTEXITCODE)." }
if (-not (Test-Path -LiteralPath $publishPath -PathType Container)) { throw 'Compiled wwwroot output was not found.' }

& aws cloudformation deploy --template-file $templatePath --stack-name $stackName --region $region
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deployment failed (exit $LASTEXITCODE). Inspect stack events before taking further action." }

$outputs = Invoke-AwsJson @('cloudformation', 'describe-stacks', '--stack-name', $stackName, '--region', $region)
$values = @{}
foreach ($output in $outputs.Stacks[0].Outputs) { $values[$output.OutputKey] = $output.OutputValue }
foreach ($key in @('BucketName', 'DistributionId', 'CloudFrontDomain', 'FrontendUrl')) {
    if (-not $values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($values[$key])) { throw "Required CloudFormation output '$key' is missing." }
}

$bucket = $values['BucketName']
if ($bucket -notmatch '^bloodlink-frontend-prod-[a-z0-9-]+$') { throw 'Generated bucket name does not match the dedicated frontend bucket naming pattern.' }
& aws s3 sync $publishPath "s3://$bucket" --delete --region $region --cache-control 'no-cache, no-store, must-revalidate' --only-show-errors
if ($LASTEXITCODE -ne 0) { throw "Frontend upload failed (exit $LASTEXITCODE)." }

$files = Get-ChildItem -LiteralPath $publishPath -File -Recurse
foreach ($file in $files) {
    $relative = $file.FullName.Substring($publishPath.TrimEnd('\').Length + 1).Replace('\', '/')
    if ($relative -match '(?i)(^|/)[^/]*[.-][a-f0-9]{8,}\.[^/.]+$' -or
        $relative -match '(?i)^_framework/dotnet\.[^/]*\.[a-z0-9]{8,}\.js$') {
        $key = [Uri]::EscapeDataString($relative).Replace('%2F', '/')
        & aws s3 cp $file.FullName "s3://$bucket/$key" --region $region --cache-control 'public, max-age=31536000, immutable' --metadata-directive REPLACE --only-show-errors
        if ($LASTEXITCODE -ne 0) { throw "Immutable asset metadata update failed for '$relative' (exit $LASTEXITCODE)." }
    }
}

$invalidation = Invoke-AwsJson @('cloudfront', 'create-invalidation', '--distribution-id', $values['DistributionId'], '--paths', '/*')
& aws cloudfront wait distribution-deployed --id $values['DistributionId']
if ($LASTEXITCODE -ne 0) { throw "CloudFront distribution did not reach Deployed status (exit $LASTEXITCODE)." }
& aws cloudfront wait invalidation-completed --distribution-id $values['DistributionId'] --id $invalidation.Invalidation.Id
if ($LASTEXITCODE -ne 0) { throw "CloudFront invalidation did not complete (exit $LASTEXITCODE)." }

[pscustomobject]@{
    StackName = $stackName
    Region = $region
    BucketName = $bucket
    DistributionId = $values['DistributionId']
    CloudFrontDomain = $values['CloudFrontDomain']
    FrontendUrl = $values['FrontendUrl']
    InvalidationId = $invalidation.Invalidation.Id
} | Format-List
