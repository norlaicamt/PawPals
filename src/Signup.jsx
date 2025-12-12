// src/Signup.jsx
import { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import logoImg from './logo.png';


const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        firstName: fname, lastName: lname, email: email, role: "owner", createdAt: new Date()
      });
      alert("Account successfully created. Signing you in . . .");
      navigate("/owner-dashboard");
    } catch (error) {
      alert("Signup Failed: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{maxWidth: "500px"}}>
        <div className="auth-header">
          {/* LOGO IMAGE HERE */}
          <img src={logoImg} alt="PawPals Logo" className="auth-logo-img" />
          
          <h2 style={{margin:0, color:"#333"}}>Join PawPals</h2>
          <p style={{margin:"5px 0 0", color:"#666"}}>Register as a Pet Owner</p>
        </div>
        
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input type="text" placeholder="First Name" onChange={(e) => setFname(e.target.value)} required />
            <input type="text" placeholder="Last Name" onChange={(e) => setLname(e.target.value)} required />
          </div>
          <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} required />
          
          <button 
            type="submit" 
            className="action-btn" 
            style={{ background: "#4CAF50", color: "white", width: "100%", padding: "12px", marginTop: "10px" }}
            disabled={loading}
          >
            {loading ? "Creating your account . . ." : "Create Account"}
          </button>
        </form>

        <p style={{marginTop: "20px", fontSize: "14px", color: "#666"}}>
            Already have an account? <br/>
            <Link to="/" className="auth-link" style={{marginTop: "5px"}}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;