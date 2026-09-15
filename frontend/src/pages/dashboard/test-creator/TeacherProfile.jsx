import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "./components/TeacherLayout";
import { CheckIcon, EditIcon } from "./components/Icons";

function TeacherProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    mobile: "",
    dob: "",
    gender: "",
    designation: "",
    department: "",
    qualification: "",
    experience: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    country: "India",
    photo: "",
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedProfile = localStorage.getItem("teacherProfile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch {}
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSaved(false);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((prev) => ({
        ...prev,
        photo: reader.result,
      }));
      setSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const completion = useMemo(() => {
    const fields = [
      "fullName",
      "email",
      "mobile",
      "dob",
      "gender",
      "designation",
      "department",
      "qualification",
      "experience",
      "address",
      "city",
      "state",
      "pinCode",
      "country",
      "photo",
    ];

    const completed = fields.filter(
      (field) => profile[field] && profile[field].toString().trim() !== ""
    ).length;

    return Math.round((completed / fields.length) * 100);
  }, [profile]);

  const handleSave = () => {
    localStorage.setItem("teacherProfile", JSON.stringify(profile));
    setSaved(true);
  };

  const handleCancel = () => {
    const savedProfile = localStorage.getItem("teacherProfile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch {}
    }
    setSaved(false);
  };

  const inputClass =
    "w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition";

  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2";

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Header */}
        <div className="border-b border-chalk-faint px-6 lg:px-8 py-5.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
              Account Management
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-tight text-chalk">
              Teacher Profile
            </h1>
            <p className="mt-1 text-sm text-chalk-muted">
              Manage your personal, professional, and contact details.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success bg-success-soft border border-success/30 px-3 py-1.5 rounded-lg">
                <CheckIcon size={14} />
                <span>Saved successfully</span>
              </span>
            )}
            <button
              onClick={handleSave}
              className="rounded-xl bg-brand-red hover:bg-brand-red-dark px-5 py-2.5 text-sm font-semibold text-chalk transition"
            >
              Save Profile
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 space-y-6 sm:space-y-7">
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-7">
            {/* Top Identity Card */}
            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-7">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Photo */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-chalk-faint bg-panel-2 flex items-center justify-center shadow-lg">
                    {profile.photo ? (
                      <img
                        src={profile.photo}
                        alt="Teacher Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl font-display text-brand-gold">
                        {profile.fullName
                          ? profile.fullName.charAt(0).toUpperCase()
                          : "T"}
                      </span>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-red text-chalk flex items-center justify-center cursor-pointer hover:bg-brand-red-dark transition shadow-md">
                    <EditIcon size={13} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Identity Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl sm:text-2xl font-semibold text-chalk truncate">
                      {profile.fullName || "Teacher Name"}
                    </h2>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-success-soft text-success border border-success/30">
                      Active
                    </span>
                  </div>

                  <p className="text-sm text-chalk-muted mt-1">
                    {profile.designation || "Instructor"}{" "}
                    {profile.department && `• ${profile.department}`}
                  </p>

                  <p className="text-xs text-chalk-muted/80 mt-1">
                    {profile.email || "No email added"}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-4 max-w-md">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-chalk-muted">Profile Completion</span>
                      <span className="font-semibold text-brand-gold">{completion}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-panel-2 overflow-hidden border border-chalk-faint">
                      <div
                        className="h-full rounded-full bg-brand-gold transition-all duration-500"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-7 space-y-5">
              <h3 className="text-base font-semibold text-chalk">Personal Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={profile.fullName}
                    onChange={handleChange}
                    placeholder="e.g. Dr. Ramesh Kumar"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={profile.email}
                    onChange={handleChange}
                    placeholder="e.g. ramesh@example.com"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Mobile Number</label>
                  <input
                    type="tel"
                    name="mobile"
                    value={profile.mobile}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={profile.dob}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Gender</label>
                  <select
                    name="gender"
                    value={profile.gender}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-7 space-y-5">
              <h3 className="text-base font-semibold text-chalk">Professional Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Designation</label>
                  <input
                    type="text"
                    name="designation"
                    value={profile.designation}
                    onChange={handleChange}
                    placeholder="e.g. Senior Faculty / Test Creator"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={profile.department}
                    onChange={handleChange}
                    placeholder="e.g. General Aptitude & Science"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Highest Qualification</label>
                  <input
                    type="text"
                    name="qualification"
                    value={profile.qualification}
                    onChange={handleChange}
                    placeholder="e.g. Ph.D. in Computer Science"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Experience (Years)</label>
                  <input
                    type="text"
                    name="experience"
                    value={profile.experience}
                    onChange={handleChange}
                    placeholder="e.g. 8 Years"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-7 space-y-5">
              <h3 className="text-base font-semibold text-chalk">Location & Address</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Street Address</label>
                  <input
                    type="text"
                    name="address"
                    value={profile.address}
                    onChange={handleChange}
                    placeholder="e.g. 124 Park Avenue, Sector 5"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={profile.city}
                    onChange={handleChange}
                    placeholder="e.g. New Delhi"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>State</label>
                  <input
                    type="text"
                    name="state"
                    value={profile.state}
                    onChange={handleChange}
                    placeholder="e.g. Delhi"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Pin Code</label>
                  <input
                    type="text"
                    name="pinCode"
                    value={profile.pinCode}
                    onChange={handleChange}
                    placeholder="e.g. 110001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Country</label>
                  <input
                    type="text"
                    name="country"
                    value={profile.country}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-brand-red hover:bg-brand-red-dark px-6 py-3 text-sm font-semibold text-chalk transition"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-5 py-3 text-sm font-medium text-chalk transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TeacherProfile;