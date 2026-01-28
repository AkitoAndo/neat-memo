#!/usr/bin/env python3
import aws_cdk as cdk

from stacks.api_stack import ApiStack
from stacks.iam_user_stack import IamUserStack

app = cdk.App()

ApiStack(app, "NeatMemoApiStack")

# 検証環境用の開発者IAMユーザー
# デプロイ: cdk deploy NeatMemoDeveloperStack
IamUserStack(app, "NeatMemoDeveloperStack", user_name="nai")

app.synth()
