#!/usr/bin/env python3
import os
import aws_cdk as cdk
from stacks.api_stack import ApiStack
from stacks.iam_user_stack import IamUserStack

app = cdk.App()

stage = app.node.try_get_context("stage") or "dev"
stack_name = f"NeatMemoApiStack-{stage}"

# Use the account/region where the CLI is configured
env = cdk.Environment(
    account=os.getenv("CDK_DEFAULT_ACCOUNT"),
    region=os.getenv("CDK_DEFAULT_REGION")
)

ApiStack(app, stack_name, stage_name=stage, env=env)

# 検証環境用の開発者IAMユーザー
# デプロイ: cdk deploy NeatMemoDeveloperStack
IamUserStack(app, "NeatMemoDeveloperStack", user_name="nai", env=env)

app.synth()
