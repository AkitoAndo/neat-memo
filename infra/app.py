#!/usr/bin/env python3
import aws_cdk as cdk

from stacks.api_stack import ApiStack

app = cdk.App()

ApiStack(app, "NeatMemoApiStack")

app.synth()
