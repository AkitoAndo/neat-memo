from aws_cdk import (
    CfnOutput,
    RemovalPolicy,
    Stack,
)
from aws_cdk import (
    aws_apigateway as apigw,
)
from aws_cdk import (
    aws_cloudfront as cloudfront,
)
from aws_cdk import (
    aws_cloudfront_origins as origins,
)
from aws_cdk import (
    aws_lambda as lambda_,
)
from aws_cdk import (
    aws_s3 as s3,
)
from aws_cdk import (
    aws_s3_deployment as s3deploy,
)
from constructs import Construct


class ApiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, stage_name: str = "dev", **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Lambda: Memo Handler
        memo_handler = lambda_.Function(
            self,
            "MemoHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("../api"),
            handler="handlers.memo.handler",
        )

        # Lambda: Hello Handler
        hello_handler = lambda_.Function(
            self,
            "HelloHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("../api"),
            handler="handlers.hello.handler",
        )

        # API Gateway
        api = apigw.RestApi(
            self,
            "MemoApi",
            rest_api_name=f"NeatMemo API ({stage_name})",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type"],
            ),
        )

        # /hello endpoint
        hello = api.root.add_resource("hello")
        hello.add_method("GET", apigw.LambdaIntegration(hello_handler))

        # /memos endpoints
        memos = api.root.add_resource("memos")
        memos.add_method("GET", apigw.LambdaIntegration(memo_handler))
        memos.add_method("POST", apigw.LambdaIntegration(memo_handler))

        memo = memos.add_resource("{memo_id}")
        memo.add_method("GET", apigw.LambdaIntegration(memo_handler))
        memo.add_method("PUT", apigw.LambdaIntegration(memo_handler))
        memo.add_method("DELETE", apigw.LambdaIntegration(memo_handler))

        # S3 Bucket for Frontend
        frontend_bucket = s3.Bucket(
            self,
            "FrontendBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
        )

        # CloudFront Distribution
        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(frontend_bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            ),
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                )
            ],
        )

        # Deploy UI to S3
        s3deploy.BucketDeployment(
            self,
            "DeployFrontend",
            sources=[
                s3deploy.Source.asset("../ui"),
                # API URLをconfig.jsとして注入
                s3deploy.Source.data(
                    "config.js",
                    f"window.API_ENDPOINT = '{api.url.rstrip('/')}';"
                ),
            ],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # Outputs
        CfnOutput(self, "ApiUrl", value=api.url, description="API Gateway URL")
        CfnOutput(
            self,
            "FrontendUrl",
            value=f"https://{distribution.distribution_domain_name}",
            description="Frontend CloudFront URL",
        )
        CfnOutput(
            self,
            "S3BucketName",
            value=frontend_bucket.bucket_name,
            description="Frontend S3 Bucket Name",
        )
