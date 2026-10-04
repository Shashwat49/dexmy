VERIFIED_TEACHER_EMAILS = frozenset({
    "singharushi15135@gmail.com",
    "harjeetkaur457@gmail.com",
    "shivamsaraswat9456@gmail.com",
    "tanmaykumar@mymail.com",
    "shobaselvam85@gmail.com",
})


def is_verified_teacher_email(email: str | None) -> bool:
    return bool(email) and email.strip().lower() in VERIFIED_TEACHER_EMAILS
