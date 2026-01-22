#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.api_stack import ApiStack

app = cdk.App()

stage = app.node.try_get_context("stage") or "dev"
stack_name = f"NeatMemoApiStack-{stage}"

ApiStack(app, stack_name, stage_name=stage)

app.synth()
