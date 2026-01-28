from aws_cdk import (
    CfnOutput,
    Stack,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class IamUserStack(Stack):
    """検証環境用の開発者IAMユーザーを作成するスタック"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        user_name: str = "neat-memo-developer",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # IAMユーザーを作成
        developer_user = iam.User(
            self,
            "DeveloperUser",
            user_name=user_name,
        )

        # 開発者向けポリシー（Lambda、API Gateway、S3、DynamoDB、CloudWatch等）
        developer_policy = iam.ManagedPolicy(
            self,
            "DeveloperPolicy",
            managed_policy_name=f"{user_name}-policy",
            statements=[
                # Lambda関連
                iam.PolicyStatement(
                    sid="LambdaAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "lambda:*",
                    ],
                    resources=["*"],
                ),
                # API Gateway関連
                iam.PolicyStatement(
                    sid="ApiGatewayAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "apigateway:*",
                    ],
                    resources=["*"],
                ),
                # S3関連
                iam.PolicyStatement(
                    sid="S3Access",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "s3:*",
                    ],
                    resources=["*"],
                ),
                # DynamoDB関連
                iam.PolicyStatement(
                    sid="DynamoDBAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "dynamodb:*",
                    ],
                    resources=["*"],
                ),
                # CloudWatch関連
                iam.PolicyStatement(
                    sid="CloudWatchAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "cloudwatch:*",
                        "logs:*",
                    ],
                    resources=["*"],
                ),
                # CloudFormation関連（CDKデプロイに必要）
                iam.PolicyStatement(
                    sid="CloudFormationAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "cloudformation:*",
                    ],
                    resources=["*"],
                ),
                # IAM関連（ロール作成等に必要、制限付き）
                iam.PolicyStatement(
                    sid="IamLimitedAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "iam:GetRole",
                        "iam:CreateRole",
                        "iam:DeleteRole",
                        "iam:AttachRolePolicy",
                        "iam:DetachRolePolicy",
                        "iam:PutRolePolicy",
                        "iam:DeleteRolePolicy",
                        "iam:GetRolePolicy",
                        "iam:PassRole",
                        "iam:TagRole",
                        "iam:UntagRole",
                    ],
                    resources=["*"],
                ),
                # SSM Parameter Store（設定値管理用）
                iam.PolicyStatement(
                    sid="SSMAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "ssm:GetParameter",
                        "ssm:GetParameters",
                        "ssm:PutParameter",
                        "ssm:DeleteParameter",
                    ],
                    resources=["*"],
                ),
                # CloudFront関連
                iam.PolicyStatement(
                    sid="CloudFrontAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "cloudfront:*",
                    ],
                    resources=["*"],
                ),
                # ECR関連（コンテナ利用時）
                iam.PolicyStatement(
                    sid="ECRAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "ecr:*",
                    ],
                    resources=["*"],
                ),
                # STS（CDKブートストラップ用）
                iam.PolicyStatement(
                    sid="STSAccess",
                    effect=iam.Effect.ALLOW,
                    actions=[
                        "sts:AssumeRole",
                    ],
                    resources=["arn:aws:iam::*:role/cdk-*"],
                ),
            ],
        )

        developer_user.add_managed_policy(developer_policy)

        # アクセスキーを作成
        access_key = iam.AccessKey(
            self,
            "DeveloperAccessKey",
            user=developer_user,
        )

        # シークレットをSecrets Managerに保存
        secret = secretsmanager.Secret(
            self,
            "DeveloperCredentials",
            secret_name=f"{user_name}-credentials",
            secret_string_value=access_key.secret_access_key,
            description=f"Access key secret for {user_name}",
        )

        # Outputs
        CfnOutput(
            self,
            "UserName",
            value=developer_user.user_name,
            description="IAM User Name",
        )
        CfnOutput(
            self,
            "AccessKeyId",
            value=access_key.access_key_id,
            description="Access Key ID",
        )
        CfnOutput(
            self,
            "SecretAccessKeyArn",
            value=secret.secret_arn,
            description="Secret ARN (retrieve secret value from Secrets Manager)",
        )
        CfnOutput(
            self,
            "GetSecretCommand",
            value=f"aws secretsmanager get-secret-value --secret-id {user_name}-credentials --query SecretString --output text",
            description="AWS CLI command to retrieve the secret access key",
        )
