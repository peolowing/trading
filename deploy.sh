#!/bin/bash

# Weekly Trading AI - Deployment Script
# Ensures screener data is fresh before deploying to production

echo "🚀 Starting deployment process..."
echo ""

# Step 1: Update screener data
echo "📊 Step 1/4: Calculating fresh screener data..."
node scripts/calculate-screener-data.js

if [ $? -ne 0 ]; then
  echo "❌ Failed to calculate screener data. Aborting deployment."
  exit 1
fi

echo ""
echo "✅ Screener data updated successfully"
echo ""

# Step 2: Run tests (if you have any)
# echo "🧪 Step 2/4: Running tests..."
# npm test
# if [ $? -ne 0 ]; then
#   echo "❌ Tests failed. Aborting deployment."
#   exit 1
# fi

# Step 3: Build frontend
echo "🏗️  Step 2/4: Building frontend..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi

echo ""
echo "✅ Build completed successfully"
echo ""

# Step 4: Verify git status
echo "📝 Step 3/4: Checking git status..."
if [[ -n $(git status -s) ]]; then
  echo "⚠️  You have uncommitted changes:"
  git status -s
  echo ""
  read -p "Do you want to commit and push? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter commit message: " commit_msg
    git add .
    git commit -m "$commit_msg"
  else
    echo "❌ Deployment cancelled. Please commit your changes first."
    exit 1
  fi
fi

# Step 5: Deploy to Vercel
echo "🚢 Step 4/4: Deploying to Vercel..."
echo ""

# Check if --prod flag was passed
if [[ "$1" == "--prod" ]]; then
  echo "📦 Deploying to PRODUCTION..."
  npx vercel --prod
else
  echo "🧪 Deploying to PREVIEW..."
  npx vercel
fi

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed."
  exit 1
fi

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🎉 Your app is live!"
