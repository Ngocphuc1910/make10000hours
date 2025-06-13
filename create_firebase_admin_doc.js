// Script to create Firebase document using Admin SDK
const admin = require('firebase-admin');

async function createDocumentWithAdmin() {
  try {
    // Initialize Firebase Admin with default credentials
    // This will use the Google Cloud credentials if available
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'make10000hours'
      });
    }

    const db = admin.firestore();

    // Document data with exact structure from existing document
    const documentData = {
      date: "2025-06-11",
      totalTime: 581754633,
      sitesVisited: 19,
      productivityScore: 100,
      userId: "7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1",
      extensionVersion: "1.0.0",
      createdAt: admin.firestore.Timestamp.fromDate(new Date("2025-06-11T04:54:02.585Z")),
      syncedAt: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z")),
      updatedAt: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z")),
      sites: {
        "localhost": {
          domain: "localhost",
          category: "uncategorized",
          visits: 82,
          timeSpent: 10593304,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "docs.google.com": {
          visits: 7,
          timeSpent: 25476,
          domain: "docs.google.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "readdy.ai": {
          visits: 6,
          timeSpent: 37917,
          domain: "readdy.ai",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "figma.com": {
          domain: "figma.com",
          category: "uncategorized",
          visits: 10,
          timeSpent: 430162,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "github.com": {
          visits: 12,
          timeSpent: 474403,
          domain: "github.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "make10000hours.com": {
          domain: "make10000hours.com",
          category: "uncategorized",
          visits: 35,
          timeSpent: 562612163,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "mail.google.com": {
          visits: 1,
          timeSpent: 2430,
          domain: "mail.google.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "t1.gstatic.com": {
          visits: 1,
          timeSpent: 1595,
          domain: "t1.gstatic.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "notion.so": {
          domain: "notion.so",
          category: "uncategorized",
          visits: 8,
          timeSpent: 305422,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "linkedin.com": {
          visits: 5,
          timeSpent: 195040,
          domain: "linkedin.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "youtube.com": {
          domain: "youtube.com",
          category: "uncategorized",
          visits: 32,
          timeSpent: 1688326,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "console.firebase.google.com": {
          domain: "console.firebase.google.com",
          category: "uncategorized",
          visits: 57,
          timeSpent: 3294781,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "layers.to": {
          visits: 1,
          timeSpent: 6889,
          domain: "layers.to",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "claude.ai": {
          visits: 8,
          timeSpent: 20506,
          domain: "claude.ai",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "highlight.io": {
          visits: 1,
          timeSpent: 2960,
          domain: "highlight.io",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "producthunt.com": {
          visits: 1,
          timeSpent: 1830,
          domain: "producthunt.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "null": {
          visits: 0,
          domain: "null",
          category: "uncategorized",
          timeSpent: 368009,
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "messenger.com": {
          visits: 4,
          timeSpent: 139235,
          domain: "messenger.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        },
        "facebook.com": {
          visits: 11,
          timeSpent: 1554185,
          domain: "facebook.com",
          category: "uncategorized",
          lastVisit: admin.firestore.Timestamp.fromDate(new Date("2025-06-13T05:39:51.205Z"))
        }
      }
    };

    // Create document with specific ID
    const docRef = db.collection('dailySiteUsage').doc('7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1_2025-06-11');
    await docRef.set(documentData);

    console.log("✅ Document created successfully with ID: 7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1_2025-06-11");
    
  } catch (error) {
    console.error("❌ Error creating document:", error);
  }
}

createDocumentWithAdmin(); 