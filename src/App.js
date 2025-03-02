import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import "./EmailVerifier.css";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAQdeTYp8cpbN2kM-MWGsqr-tDd4L8pJgw",
  authDomain: "email-verifier-2d5bf.firebaseapp.com",
  projectId: "email-verifier-2d5bf",
  storageBucket: "email-verifier-2d5bf.appspot.com",
  messagingSenderId: "781742681227",
  appId: "1:781742681227:web:6f2b31a109bf432782388e",
  measurementId: "G-VYPZB39N4G",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function EmailVerifier() {
  const [file, setFile] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [columns, setColumns] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState({ valid: null, invalid: null, catchAll: null });
  const [progress, setProgress] = useState(0);
  const [credits, setCredits] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [duplicateEntries, setDuplicateEntries] = useState(0);
  const [creditsRequired, setCreditsRequired] = useState(0);
  const [blankEntries, setBlankEntries] = useState(0);
  const [verificationResults, setVerificationResults] = useState({
    valid: 0,
    invalid: 0,
    catchAll: 0,
    singleStatus: null,
  });
  const [mode, setMode] = useState("bulk");
  const [singleEmail, setSingleEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsLoggedIn(true);
        fetchCredits();
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch credits from the backend
  const fetchCredits = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user logged in.");
        return;
      }

      const idToken = await user.getIdToken();
      const userId = user.uid;

      const response = await fetch(`http://localhost:5001/credits/${userId}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch credits");
      }

      const data = await response.json();
      setCredits(data.credits);
    } catch (error) {
      console.error("Error fetching credits:", error);
    }
  };

  // Handle login
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      setIsLoggedIn(true);
      setShowAuthModal(false);
      toast.success("Login successful!");
      fetchCredits(); // Fetch credits after login
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Invalid email or password.");
    }
  };

  // Handle registration
  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      setIsLoggedIn(true);
      setShowAuthModal(false);
      toast.success("Registration successful!");
      fetchCredits(); // Fetch credits after registration
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register. Please try again.");
    }
  };

  // Handle file upload and column selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSelectedColumn("");
      setColumns([]);
      setTotalEntries(0);
      setDuplicateEntries(0);
      setCreditsRequired(0);
      setBlankEntries(0);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split("\n").map((row) => row.trim());
        const firstLine = rows[0];
        const columns = firstLine.split(",").map((col) => col.trim());
        setColumns(columns);
      };
      reader.readAsText(selectedFile);
    }
  };

  // Handle column selection
  const handleColumnSelect = (column) => {
    setSelectedColumn(column);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split("\n").map((row) => row.trim()).filter((row) => row !== "");
      const headers = rows[0].split(",").map((header) => header.trim().replace(/"/g, ""));
      const dataRows = rows.slice(1);
      const colIndex = headers.indexOf(column);
      if (colIndex === -1) {
        console.error("Selected column not found in CSV headers.");
        return;
      }

      const values = dataRows.map((row, rowIndex) => {
        const columns = parseCSVRow(row);
        const value = columns[colIndex] || "";
        return value;
      });

      setTotalEntries(values.length);

      const blankCount = values.filter((value) => value === "").length;
      setBlankEntries(blankCount);

      const duplicateMap = new Map();
      values.forEach((value, index) => {
        if (value !== "") {
          if (!duplicateMap.has(value)) {
            duplicateMap.set(value, []);
          }
          duplicateMap.get(value).push(index + 1);
        }
      });

      let duplicateCount = 0;
      duplicateMap.forEach((rowNumbers, value) => {
        if (rowNumbers.length > 1) {
          duplicateCount += rowNumbers.length - 1;
        }
      });

      setDuplicateEntries(duplicateCount);
      setCreditsRequired(values.length - blankCount - duplicateCount);
    };
    reader.readAsText(file);
  };

  // Parse CSV row
  const parseCSVRow = (row) => {
    const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
    const columns = [];
    let match;
    while ((match = regex.exec(row))) {
      let value = match[1];
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }
      columns.push(value.trim());
    }
    return columns;
  };

  // Handle bulk email verification
  const handleVerify = async () => {
    if (!file || !selectedColumn) {
      toast.error("Please select a file and column!");
      return;
    }

    if (credits < creditsRequired) {
      toast.error("Not enough credits!");
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("column", selectedColumn);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("http://localhost:5001/verify", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setDownloadUrls({
          valid: data.validDownloadLink ? `http://localhost:5001${data.validDownloadLink}` : null,
          invalid: data.invalidDownloadLink ? `http://localhost:5001${data.invalidDownloadLink}` : null,
          catchAll: data.catchAllDownloadLink ? `http://localhost:5001${data.catchAllDownloadLink}` : null,
        });
        setVerificationResults({
          valid: data.validCount || 0,
          invalid: data.invalidCount || 0,
          catchAll: data.catchAllCount || 0,
        });
        toast.success("Verification complete!");

        // Fetch updated credits after verification
        await fetchCredits();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("An error occurred!");
    } finally {
      setIsProcessing(false);
      setProgress(0); // Reset progress after verification
    }
  };

  // Handle single email verification
  const handleVerifySingleEmail = async () => {
    if (!singleEmail || !singleEmail.includes("@")) {
      toast.error("Please enter a valid email address!");
      return;
    }

    if (credits < 1) {
      toast.error("Not enough credits!");
      return;
    }

    setIsProcessing(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("http://localhost:5001/verify-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: singleEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationResults((prev) => ({
          ...prev,
          singleStatus: data.status,
        }));
        toast.success(`Email verification result: ${data.status}`);

        // Fetch updated credits after verification
        await fetchCredits();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("An error occurred!");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file download
  const handleDownload = (type) => {
    if (!downloadUrls[type]) {
      toast.error("File not available for download!");
      return;
    }

    fetch(downloadUrls[type])
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}_emails.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error("Download error:", error);
        toast.error("Failed to download file!");
      });
  };

  // SSE Connection for Progress Updates
  useEffect(() => {
    if (isProcessing) {
      const eventSource = new EventSource("http://localhost:5001/progress");

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data.progress);
      };

      eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [isProcessing]);

  return (
    <div className="email-verifier-container">
      <header className="header">
        <h1>Email Verifier</h1>
        <p className="credits">
          Credits Left: <span>{credits}</span>
        </p>
        {!isLoggedIn ? (
          <button className="login-button" onClick={() => setShowAuthModal(true)}>
            Login / Register
          </button>
        ) : (
          <button
            className="logout-button"
            onClick={() => auth.signOut().then(() => toast.success("Logged out successfully!"))}
          >
            Logout
          </button>
        )}
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="auth-modal">
          <div className="auth-content">
            <h2>{authMode === "login" ? "Login" : "Register"}</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={authMode === "login" ? handleLogin : handleRegister}>
              {authMode === "login" ? "Login" : "Register"}
            </button>
            <p>
              {authMode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <span onClick={() => setAuthMode("register")}>Register</span>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <span onClick={() => setAuthMode("login")}>Login</span>
                </>
              )}
            </p>
            <button className="close-modal" onClick={() => setShowAuthModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
  
      {/* Menu Bar */}
      <nav className="menu-bar">
        <button onClick={() => setMode("bulk")} className={mode === "bulk" ? "active" : ""}>
          Bulk Email Verification
        </button>
        <button onClick={() => setMode("single")} className={mode === "single" ? "active" : ""}>
          Single Email Verification
        </button>
      </nav>
  
      {/* Scrollable Content Section */}
      <div className="content">
        {/* Bulk Email Verification Section */}
        {mode === "bulk" && (
          <section className="bulk-verification">
            <div className="file-upload">
              <label htmlFor="file-input" className="upload-label">
                Upload CSV File
              </label>
              <input id="file-input" type="file" onChange={handleFileChange} accept=".csv" />
            </div>
  
            {columns.length > 0 && (
              <div className="column-selector">
                <label>Select Column:</label>
                <select value={selectedColumn} onChange={(e) => handleColumnSelect(e.target.value)}>
                  <option value="">Select Column</option>
                  {columns.map((col, index) => (
                    <option key={index} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            )}
  
            {selectedColumn && (
              <div className="file-stats">
                <p>
                  <span>Total Entries:</span> {totalEntries}
                </p>
                <p>
                  <span>Blank Entries:</span> {blankEntries}
                </p>
                <p>
                  <span>Duplicate Entries:</span> {duplicateEntries}
                </p>
                <p>
                  <span>Credits Required:</span> {creditsRequired}
                </p>
              </div>
            )}
  
            <button className="verify-button" onClick={handleVerify} disabled={isProcessing || credits < creditsRequired}>
              {isProcessing ? "Processing..." : "Verify Emails"}
            </button>
  
            {/* Progress Bar (Conditional Rendering) */}
            {isProcessing && (
              <div className="progress-container">
                <progress value={progress} max="100"></progress>
                <p>{progress}% completed</p>
              </div>
            )}
  
  {Object.keys(downloadUrls).some((type) => downloadUrls[type]) && (
  <div className="download-buttons">
    {Object.keys(downloadUrls).map(
      (type) =>
        downloadUrls[type] && (
          <button key={type} className="download-button" onClick={() => handleDownload(type)}>
            Download {type.charAt(0).toUpperCase() + type.slice(1)} Emails
          </button>
        )
    )}
  </div>
)}
  
            {/* Dashboard Section */}
            {downloadUrls.valid !== null && (
              <div className="dashboard">
                <h3>Verification Results</h3>
                <div className="dashboard-results">
                  <div className="result-card valid">
                    <h4>Valid Emails</h4>
                    <p>{verificationResults.valid}</p>
                  </div>
                  <div className="result-card invalid">
                    <h4>Invalid Emails</h4>
                    <p>{verificationResults.invalid}</p>
                  </div>
                  <div className="result-card catch-all">
                    <h4>Catch-All Emails</h4>
                    <p>{verificationResults.catchAll}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
  
        {/* Single Email Verification Section */}
        {mode === "single" && (
          <section className="single-verification">
            <h3>Single Email Verification</h3>
            <div className="email-input">
              <input type="email" placeholder="Enter email address" value={singleEmail} onChange={(e) => setSingleEmail(e.target.value)} />
              <button className="verify-button" onClick={handleVerifySingleEmail} disabled={isProcessing || credits < 1}>
                {isProcessing ? "Verifying..." : "Verify Email"}
              </button>
            </div>
  
            {/* Display Single Verification Result */}
            {singleEmail && (
              <div className="verification-result">
                <h4>Verification Result:</h4>
                <p>
                  <strong>Email:</strong> {singleEmail}
                </p>
                <p>
                  <strong>Status:</strong> {verificationResults.singleStatus || "Not verified yet"}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
  
     {/* Footer Section */}
<footer className="footer">
  <p>Rishesh Gangwar &copy; {new Date().getFullYear()} Email Verifier. All rights reserved.</p>
  <p>
    <a href="/privacy-policy">Privacy Policy</a> | <a href="/terms-of-service">Terms of Service</a>
  </p>
</footer>

    </div>
  );
}
