$ErrorActionPreference = "Stop"

firebase deploy --only firestore:rules,firestore:indexes
