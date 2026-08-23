import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { CalendarIcon, UsersIcon, BookIcon, GearIcon } from "../../../components/dashboard/icons";

import { getSubjects } from "../../../api/subjects";
import {
  getAvailableSlots,
  createBooking,
} from "../../../api/bookings";


const navItems = [
  {
    label: "Learn",
    items: [
      {
        path: "/dashboard/student",
        label: "My classes",
        icon: <CalendarIcon />,
      },
      {
        path: "/dashboard/student/book",
        label: "Book a class",
        icon: <UsersIcon />,
      },
      {
        path: "/dashboard/student/notes",
        label: "My notes",
        icon: <BookIcon />,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        path: "/dashboard/student/account",
        label: "My account",
        icon: <GearIcon />,
      },
    ],
  },
];


function formatSlotTime(dateString) {
  return new Date(
    dateString
  ).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}


function formatTomorrow(dateString) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
}


export default function BookClass() {
  const navigate = useNavigate();

  const [subjects, setSubjects] =
    useState([]);

  const [selectedSubject, setSelectedSubject] =
    useState(null);

  const [slotData, setSlotData] =
    useState(null);

  const [selectedSlot, setSelectedSlot] =
    useState(null);

  const [loadingSubjects, setLoadingSubjects] =
    useState(true);

  const [loadingSlots, setLoadingSlots] =
    useState(false);

  const [booking, setBooking] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(null);


  /*
   * ============================================================
   * LOAD SUBJECTS
   * ============================================================
   */

  useEffect(() => {
    async function loadSubjects() {
      try {
        setLoadingSubjects(true);
        setError("");

        const data =
          await getSubjects();

        setSubjects(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(
          "Unable to load subjects:",
          err
        );

        setError(
          err.response?.data?.detail ||
            "Unable to load subjects."
        );
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
  }, []);


  /*
   * ============================================================
   * LOAD TOMORROW'S SLOTS
   * ============================================================
   */

  useEffect(() => {
    if (!selectedSubject) {
      setSlotData(null);
      setSelectedSlot(null);
      return;
    }

    async function loadSlots() {
      try {
        setLoadingSlots(true);
        setError("");
        setSelectedSlot(null);

        const data =
          await getAvailableSlots(
            selectedSubject.id
          );

        setSlotData(data);
      } catch (err) {
        console.error(
          "Unable to load available slots:",
          err
        );

        setSlotData(null);

        setError(
          err.response?.data?.detail ||
            "Unable to load available slots."
        );
      } finally {
        setLoadingSlots(false);
      }
    }

    loadSlots();
  }, [selectedSubject]);


  /*
   * ============================================================
   * AVAILABLE SLOT COUNT
   * ============================================================
   */

  const availableSlotCount =
    useMemo(() => {
      if (!slotData?.slots) {
        return 0;
      }

      return slotData.slots.filter(
        (slot) => slot.available
      ).length;
    }, [slotData]);


  /*
   * ============================================================
   * SELECT SUBJECT
   * ============================================================
   */

  function handleSubjectSelect(subject) {
    setSelectedSubject(subject);
    setSelectedSlot(null);
    setSuccess(null);
    setError("");
  }


  /*
   * ============================================================
   * CONFIRM BOOKING
   * ============================================================
   */

  async function handleConfirmBooking() {
    if (
      !selectedSubject ||
      !selectedSlot
    ) {
      return;
    }

    try {
      setBooking(true);
      setError("");
      setSuccess(null);

      const createdBooking =
        await createBooking(
          selectedSubject.id,
          selectedSlot.start
        );

      setSuccess(
        createdBooking
      );

    } catch (err) {
      console.error(
        "Booking failed:",
        err
      );

      setError(
        err.response?.data?.detail ||
          "Unable to create your booking."
      );
    } finally {
      setBooking(false);
    }
  }


  /*
   * ============================================================
   * SUCCESS SCREEN
   * ============================================================
   */

  if (success) {
    return (
      <DashboardLayout
        navItems={navItems}
      >
        <div className="flex min-h-full items-center justify-center px-8 py-12">

          <div className="w-full max-w-xl rounded-2xl border border-chalk-faint bg-panel-2 p-8 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-2xl text-green-400">
              ✓
            </div>

            <h1 className="mt-6 font-display text-2xl">
              Class booked successfully
            </h1>

            <p className="mt-3 text-sm leading-6 text-chalk-muted">
              Your class has been scheduled
              for tomorrow.
            </p>

            <div className="mt-6 rounded-xl border border-chalk-faint bg-panel p-5 text-left">

              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-xs text-chalk-muted">
                    Subject
                  </p>

                  <p className="mt-1 font-semibold">
                    {
                      success.subject_name
                    }
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-chalk-muted">
                    Status
                  </p>

                  <p className="mt-1 text-sm font-semibold text-green-400">
                    Confirmed
                  </p>
                </div>

              </div>


              <div className="mt-5 border-t border-chalk-faint pt-5">

                <p className="text-xs text-chalk-muted">
                  Class time
                </p>

                <p className="mt-1 font-semibold">
                  {new Date(
                    success.scheduled_at
                  ).toLocaleDateString(
                    "en-US",
                    {
                      weekday:
                        "long",
                      month:
                        "long",
                      day:
                        "numeric",
                    }
                  )}
                </p>

                <p className="mt-1 text-sm text-chalk-muted">
                  {formatSlotTime(
                    success.scheduled_at
                  )}
                </p>

              </div>


              <div className="mt-5 border-t border-chalk-faint pt-5">

                <p className="text-xs text-chalk-muted">
                  Teacher
                </p>

                <p className="mt-1 text-sm">
                  Your teacher will be
                  assigned by Dexmy.
                </p>

              </div>

            </div>


            <div className="mt-7 flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/dashboard/student"
                  )
                }
                className="flex-1 rounded-lg bg-brand-gold px-5 py-3 text-sm font-bold text-[#2C1E04] transition-colors hover:bg-[#FFC94D]"
              >
                View my classes
              </button>

              <button
                type="button"
                onClick={() => {
                  setSuccess(null);
                  setSelectedSubject(null);
                  setSelectedSlot(null);
                  setSlotData(null);
                }}
                className="flex-1 rounded-lg border border-chalk-faint px-5 py-3 text-sm font-semibold text-chalk transition-colors hover:border-chalk-muted"
              >
                Book another class
              </button>

            </div>

          </div>

        </div>
      </DashboardLayout>
    );
  }


  /*
   * ============================================================
   * MAIN BOOKING PAGE
   * ============================================================
   */

  return (
    <DashboardLayout
      navItems={navItems}
    >
      <div className="flex items-center justify-between border-b border-chalk-faint px-8 py-5.5">

        <div>
          <h1 className="font-display text-2xl">
            Book a class
          </h1>

          <p className="mt-1 text-sm text-chalk-muted">
            Choose your subject and a
            time for tomorrow.
          </p>
        </div>

      </div>


      <div className="flex-1 overflow-auto px-8 py-7">

        {/* =====================================================
            BOOKING RULE
        ====================================================== */}

        <div className="mb-7 rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-5 py-4">

          <div className="flex gap-3">

            <div className="mt-0.5 text-brand-gold">
              ●
            </div>

            <div>

              <p className="text-sm font-semibold">
                Classes are scheduled
                for tomorrow
              </p>

              <p className="mt-1 text-xs leading-5 text-chalk-muted">
                Dexmy classes are available
                from 10:00 AM to 10:00 PM
                IST. You can choose an
                available hourly slot.
              </p>

            </div>

          </div>

        </div>


        {/* =====================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">
            {error}
          </div>
        )}


        {/* =====================================================
            STEP 1 — SUBJECT
        ====================================================== */}

        <section>

          <div className="mb-4">

            <div className="flex items-center gap-3">

              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-xs font-bold">
                1
              </span>

              <h2 className="text-lg font-semibold">
                Choose a subject
              </h2>

            </div>

            <p className="mt-2 ml-10 text-sm text-chalk-muted">
              Select the subject you want
              to study.
            </p>

          </div>


          {loadingSubjects ? (

            <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">
              <p className="text-sm text-chalk-muted">
                Loading subjects...
              </p>
            </div>

          ) : subjects.length === 0 ? (

            <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">
              <p className="text-sm text-chalk-muted">
                No subjects are currently
                available.
              </p>
            </div>

          ) : (

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

              {subjects.map(
                (subject) => {

                  const selected =
                    selectedSubject?.id ===
                    subject.id;

                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() =>
                        handleSubjectSelect(
                          subject
                        )
                      }
                      className={`rounded-xl border p-5 text-left transition-all ${
                        selected
                          ? "border-brand-gold bg-brand-gold/10"
                          : "border-chalk-faint bg-panel-2 hover:border-chalk-muted"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <h3 className="font-semibold">
                            {subject.name}
                          </h3>

                          {subject.description && (
                            <p className="mt-2 text-xs leading-5 text-chalk-muted">
                              {
                                subject.description
                              }
                            </p>
                          )}

                        </div>


                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-brand-gold bg-brand-gold text-[#2C1E04]"
                              : "border-chalk-muted"
                          }`}
                        >
                          {selected && (
                            <span className="text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

          )}

        </section>


        {/* =====================================================
            STEP 2 — TOMORROW + SLOTS
        ====================================================== */}

        {selectedSubject && (
          <section className="mt-10">

            <div className="mb-4">

              <div className="flex items-center gap-3">

                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-xs font-bold">
                  2
                </span>

                <h2 className="text-lg font-semibold">
                  Choose a time
                </h2>

              </div>

              <div className="ml-10 mt-2">

                {slotData ? (
                  <>
                    <p className="text-sm text-chalk-muted">
                      Tomorrow —{" "}
                      {formatTomorrow(
                        slotData.date
                      )}
                    </p>

                    <p className="mt-1 text-xs text-chalk-muted">
                      {availableSlotCount}{" "}
                      available{" "}
                      {availableSlotCount ===
                      1
                        ? "slot"
                        : "slots"}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-chalk-muted">
                    Loading tomorrow's
                    availability...
                  </p>
                )}

              </div>

            </div>


            {loadingSlots ? (

              <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">
                <p className="text-sm text-chalk-muted">
                  Checking available
                  teachers and slots...
                </p>
              </div>

            ) : slotData?.slots?.length ? (

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">

                {slotData.slots.map(
                  (slot) => {

                    const selected =
                      selectedSlot?.start ===
                      slot.start;

                    return (
                      <button
                        key={slot.start}
                        type="button"
                        disabled={
                          !slot.available
                        }
                        onClick={() =>
                          setSelectedSlot(
                            slot
                          )
                        }
                        className={`rounded-xl border px-4 py-4 text-center transition-all ${
                          !slot.available
                            ? "cursor-not-allowed border-chalk-faint bg-panel-2 opacity-40"
                            : selected
                            ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                            : "border-chalk-faint bg-panel-2 hover:border-brand-gold"
                        }`}
                      >

                        <p className="text-sm font-semibold">
                          {formatSlotTime(
                            slot.start
                          )}
                        </p>

                        <p className="mt-1 text-[11px] text-chalk-muted">
                          {!slot.available
                            ? "Full"
                            : `${slot.remaining_capacity} ${
                                slot.remaining_capacity ===
                                1
                                  ? "place"
                                  : "places"
                              }`}
                        </p>

                      </button>
                    );
                  }
                )}

              </div>

            ) : (

              <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">

                <p className="text-sm text-chalk-muted">
                  There are currently no
                  available slots for this
                  subject tomorrow.
                </p>

              </div>

            )}

          </section>
        )}


        {/* =====================================================
            STEP 3 — REVIEW
        ====================================================== */}

        {selectedSubject &&
          selectedSlot && (
            <section className="mt-10">

              <div className="mb-4">

                <div className="flex items-center gap-3">

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-red text-xs font-bold">
                    3
                  </span>

                  <h2 className="text-lg font-semibold">
                    Review your booking
                  </h2>

                </div>

              </div>


              <div className="max-w-2xl rounded-2xl border border-chalk-faint bg-panel-2 p-6">

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  <div>

                    <p className="text-xs text-chalk-muted">
                      Subject
                    </p>

                    <p className="mt-1 font-semibold">
                      {
                        selectedSubject.name
                      }
                    </p>

                  </div>


                  <div>

                    <p className="text-xs text-chalk-muted">
                      Date
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatTomorrow(
                        slotData.date
                      )}
                    </p>

                  </div>


                  <div>

                    <p className="text-xs text-chalk-muted">
                      Time
                    </p>

                    <p className="mt-1 font-semibold">
                      {formatSlotTime(
                        selectedSlot.start
                      )}
                    </p>

                  </div>


                  <div>

                    <p className="text-xs text-chalk-muted">
                      Duration
                    </p>

                    <p className="mt-1 font-semibold">
                      55 minutes
                    </p>

                  </div>

                </div>


                <div className="mt-6 border-t border-chalk-faint pt-5">

                  <p className="text-xs leading-5 text-chalk-muted">
                    Your teacher will be
                    assigned by Dexmy after
                    the booking. You do not
                    need to select a teacher.
                  </p>

                </div>


                <button
                  type="button"
                  disabled={booking}
                  onClick={
                    handleConfirmBooking
                  }
                  className="mt-6 w-full rounded-lg bg-brand-gold px-5 py-3 text-sm font-bold text-[#2C1E04] transition-colors hover:bg-[#FFC94D] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {booking
                    ? "Confirming booking..."
                    : "Confirm booking"}
                </button>

              </div>

            </section>
          )}


        <div className="h-10" />

      </div>
    </DashboardLayout>
  );
}