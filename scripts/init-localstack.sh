#!/bin/bash

echo "Initializing LocalStack SES..."
awslocal ses verify-email-identity --email-address noreply@projecthub.local
awslocal ses verify-domain-identity --domain projecthub.local
echo "LocalStack SES initialization completed."
