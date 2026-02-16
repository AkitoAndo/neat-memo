from aws_cdk import (
    CfnOutput,
    Duration,
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
    aws_cognito as cognito,
)
from aws_cdk import (
    aws_dynamodb as dynamodb,
)
from aws_cdk import (
    aws_iam as iam,
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

        # ---------------------------------------------------------------------
        # Auth
        # ---------------------------------------------------------------------

        # Cognito User Pool
        user_pool = cognito.UserPool(
            self,
            "NeatMemoUserPool",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(email=True, username=False),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Cognito User Pool Client
        user_pool_client = user_pool.add_client(
            "NeatMemoClient",
            user_pool_client_name="NeatMemoClient",
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
            ),
        )

        # ---------------------------------------------------------------------
        # Database (DynamoDB)
        # ---------------------------------------------------------------------

        memo_table = dynamodb.Table(
            self,
            "MemoTable",
            partition_key=dynamodb.Attribute(
                name="user_id",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="memo_id",
                type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # ---------------------------------------------------------------------
        # Compute (Lambda)
        # ---------------------------------------------------------------------

        # Lambda: Memo Handler
        memo_handler = lambda_.Function(
            self,
            "MemoHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("../api"),
            handler="handlers.memo.handler",
            environment={
                "DYNAMO_TABLE_NAME": memo_table.table_name,
            },
            timeout=Duration.seconds(30),
        )

        # Grant DynamoDB read/write access
        memo_table.grant_read_write_data(memo_handler)

        # Lambda: Hello Handler
        hello_handler = lambda_.Function(
            self,
            "HelloHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("../api"),
            handler="handlers.hello.handler",
        )

        # S3 Bucket for OCR (temporary storage, 7-day retention)
        ocr_bucket = s3.Bucket(
            self,
            "OcrBucket",
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(7),
                )
            ],
        )

        # Lambda: OCR Handler
        ocr_handler = lambda_.Function(
            self,
            "OcrHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("../api"),
            handler="handlers.ocr.handler",
            timeout=Duration.seconds(30),
            memory_size=512,
            environment={
                "OCR_BUCKET_NAME": ocr_bucket.bucket_name,
            },
        )

        # Grant OCR Lambda permissions
        ocr_bucket.grant_write(ocr_handler)

        # Grant Bedrock InvokeModel permission
        ocr_handler.add_to_role_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel"],
                resources=["arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"],
            )
        )

        # ---------------------------------------------------------------------
        # API Gateway
        # ---------------------------------------------------------------------

        api = apigw.RestApi(
            self,
            "MemoApi",
            rest_api_name=f"NeatMemo API ({stage_name})",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type", "Authorization"],
            ),
            binary_media_types=["multipart/form-data"],
        )

        # Cognito Authorizer
        authorizer = apigw.CognitoUserPoolsAuthorizer(
            self,
            "NeatMemoAuthorizer",
            cognito_user_pools=[user_pool],
        )

        # /hello endpoint (Public)
        hello = api.root.add_resource("hello")
        hello.add_method("GET", apigw.LambdaIntegration(hello_handler))

        # /memos endpoints (Protected)
        memos = api.root.add_resource("memos")
        memos.add_method(
            "GET",
            apigw.LambdaIntegration(memo_handler),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )
        memos.add_method(
            "POST",
            apigw.LambdaIntegration(memo_handler),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )

        memo = memos.add_resource("{memo_id}")
        memo.add_method(
            "GET",
            apigw.LambdaIntegration(memo_handler),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )
        memo.add_method(
            "PUT",
            apigw.LambdaIntegration(memo_handler),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )
        memo.add_method(
            "DELETE",
            apigw.LambdaIntegration(memo_handler),
            authorizer=authorizer,
            authorization_type=apigw.AuthorizationType.COGNITO,
        )

        # ---------------------------------------------------------------------
        # Frontend Hosting
        # ---------------------------------------------------------------------

        # /ocr/jobs endpoints
        ocr = api.root.add_resource("ocr")
        ocr_jobs = ocr.add_resource("jobs")
        ocr_jobs.add_method("POST", apigw.LambdaIntegration(ocr_handler))

        ocr_job = ocr_jobs.add_resource("{job_id}")
        ocr_job.add_method("GET", apigw.LambdaIntegration(ocr_handler))

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
                s3deploy.Source.asset("../ui/dist"),
                # API URL & Auth Config injection
                s3deploy.Source.data(
                    "config.js",
                    f"""window.ENV = {{
                        API_ENDPOINT: '{api.url.rstrip('/')}',
                        USER_POOL_ID: '{user_pool.user_pool_id}',
                        USER_POOL_CLIENT_ID: '{user_pool_client.user_pool_client_id}',
                        REGION: '{self.region}'
                    }};
"""
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
        CfnOutput(self, "DistributionId", value=distribution.distribution_id)
        CfnOutput(self, "UserPoolId", value=user_pool.user_pool_id)
        CfnOutput(self, "UserPoolClientId", value=user_pool_client.user_pool_client_id)
        CfnOutput(self, "DynamoTableName", value=memo_table.table_name)
        CfnOutput(
            self,
            "S3BucketName",
            value=frontend_bucket.bucket_name,
            description="Frontend S3 Bucket Name",
        )
