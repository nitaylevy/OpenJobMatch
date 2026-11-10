# AWS Lambda Deployment Guide

This guide walks through configuring and deploying two serverless functions:
1. **`resume-parser-api`**: An HTTP/Function URL-triggered Lambda integrating AWS Textract and Bedrock.
2. **`job-scaner-api`**: An event-driven Lambda triggered via Amazon SQS with Bedrock and S3 access.

---

## 1. Resume Parser Function (`resume-parser-api`)
<img width="1900" height="1463" alt="צילום מסך 2026-11-10 133032" src="https://github.com/user-attachments/assets/c191aea5-8a98-4cee-ab16-c44f2f050f8e" />

### Step 1: Create the Function
1. Log in to the **AWS Management Console** and navigate to **AWS Lambda**.
2. Click **Create function** → Choose **Author from scratch**.
3. Set **Function name** to:
   ```text
   resume-parser-api
   ```
4. Choose your runtime (e.g., Python 3.12+).

### Step 2: Upload Code & General Configuration
1. Under the **Code** tab, paste or upload the implementation from `resume-parser-api.py`.
2. Go to the **Configuration** tab → **General configuration** → click **Edit**:
   * **Memory:** `512 MB`
   * **Timeout:** `30 sec`
3. Click **Save**.

### Step 3: Configure IAM Execution Role
1. In the **Configuration** tab, select **Permissions**.
2. Click the link under **Role name** to open **View role details in IAM**.
3. Under the **Permissions** tab in IAM, click **Add permissions** → **Create inline policy**.
4. Switch to the **JSON** tab, paste the following policy, and name it `ResumeParserPolicy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "textract:DetectDocumentText",
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```
5. Click **Create policy**.

### Step 4: Configure Function URL & Deploy
1. Back in the Lambda console, select **Configuration** → **Function URL** → **Create function URL** (or **Edit**).
2. Select the following options:
<img width="1837" height="1240" alt="צילום מסך 2026-11-10 134653" src="https://github.com/user-attachments/assets/d8d6a1e4-9b03-4b4c-b602-3815f1bef09d" />
<img width="1937" height="575" alt="צילום מסך 2026-11-10 134712" src="https://github.com/user-attachments/assets/787886fc-5c50-41ca-8537-753dc6dd5837" />


3. Under the **Code** tab, click **Deploy**.
4. Copy the generated **Function URL** and save it in your local `.env` file in the frontend or evaluations directory.

---

## 2. Job Scanner Function (`job-scaner-api`)
<img width="1905" height="677" alt="צילום מסך 2026-11-10 135548" src="https://github.com/user-attachments/assets/b5672053-99a6-4b35-ad2f-6d46a692bb4e" />

### Step 1: Create an S3 Bucket and SQS instance.
Before creating the Lambda function, set up the required storage bucket and messaging queue:

1. **Create the S3 Bucket:**
   * Go to **Amazon S3** → **Create bucket**.
   * Set **Bucket name** to:
     ```text
     daily-scanned-jobs
     ```
   * Choose your desired AWS Region (e.g., `eu-west-1`) and keep the remaining settings default or as required by your security policy.
   * Click **Create bucket**.

2. **Create the SQS Queue:**
   * Go to **Amazon SQS** → **Create queue**.
   * Select **Standard** queue type.
   * Set **Name** to:
     ```text
     job-parsing-queue
     ```
   * Retain standard settings (or adjust visibility timeout to be at least equal to your Lambda's 30s timeout, e.g., 35–60 seconds).
   * Click **Create queue** and note down its ARN.

### Step 2: Create the Function
1. In AWS Lambda, click **Create function** → **Author from scratch**.
2. Set **Function name** to:
   ```text
   job-scaner-api
   ```
3. Set the runtime (matching your Python version).

### Step 3: Configure Code & General Settings
1. Paste the corresponding source code into the **Code** tab.
2. Under **Configuration** → **General configuration**:
   * **Memory:** `512 MB`
   * **Timeout:** `40 sec`

### Step 4: Configure IAM Policies
Navigate to the IAM Role via **Configuration** → **Permissions**, and attach the following three inline policies:

#### Policy A: `AllowWriteDailyScannedJobs`
Allows saving scanned outputs directly into your S3 bucket.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLambdaPutJobFiles",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::daily-scanned-jobs/*"
    }
  ]
}
```

#### Policy B: `invoke_bedrock`
Grants permission to invoke Google Gemma models in Bedrock (`eu-west-1`).
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:eu-west-1::foundation-model/google.gemma*"
    }
  ]
}
```

#### Policy C: `sqs_policy`
Grants read and cleanup permissions on your specific queue.  
*(Replace `<ARN code>` and `<Your SQS Name>` with your actual account ID and queue name)*.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:eu-west-1:<ARN code>:<Your SQS Name>"
    }
  ]
}
```

### Step 5: Add SQS Trigger & Deploy
1. Unlike `resume-parser-api`, **do not** configure a Function URL.
2. Go to **Configuration** → **Triggers** → click **Add trigger**.
3. Select **SQS** as the source.
4. Choose your configured queue (`<Your SQS Name>`).
5. Set the batch size to 1 and click **Add**.
6. Switch to the **Code** tab and click **Deploy**.
7. Copy your SQS URL and save it in your local `.env` file in the evaluations directory.
