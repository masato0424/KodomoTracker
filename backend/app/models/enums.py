from enum import StrEnum


class RelationshipType(StrEnum):
    """Relationship between a user and a child."""

    FATHER = "father"
    MOTHER = "mother"
    GRANDFATHER = "grandfather"
    GRANDMOTHER = "grandmother"
    BABYSITTER = "babysitter"
    OTHER = "other"


class UserRole(StrEnum):
    """Permission role for a user account."""

    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class ThemeMode(StrEnum):
    """UI color mode per user account."""

    LIGHT = "light"
    DARK = "dark"


class Gender(StrEnum):
    """Child's gender (used for growth curve statistics, etc.)."""

    MALE = "male"
    FEMALE = "female"
    UNSPECIFIED = "unspecified"


class ChildColorTheme(StrEnum):
    """Personalized UI accent color theme per child (6 colors)."""

    BLUE = "blue"
    PINK = "pink"
    EMERALD = "emerald"
    ORANGE = "orange"
    PURPLE = "purple"
    TEAL = "teal"


class RecordCategory(StrEnum):
    """Category of growth and daily life log records."""

    MILK = "milk"
    BABY_FOOD = "baby_food"
    MEAL = "meal"
    SLEEP = "sleep"
    EXCRETION = "excretion"
    BODY_TEMP = "body_temp"
    HEIGHT = "height"
    WEIGHT = "weight"
    HEAD_CIRCUMFERENCE = "head_circumference"
    CHEST_CIRCUMFERENCE = "chest_circumference"
    FOOT_SIZE = "foot_size"
    CUSTOM = "custom"


class FrequencyType(StrEnum):
    """Medication intake timing/frequency type (PRD 6.4)."""

    AFTERMEAL = "aftermeal"
    INTERVALHOURS = "intervalhours"
    SPECIFICTIME = "specifictime"


class CameraEventType(StrEnum):
    """Event type detected by edge AI smart cameras (PRD 6.5)."""

    SLEEPSTART = "sleepstart"
    SLEEPEND = "sleepend"
    ROLLOVER = "rollover"
    CRAWL = "crawl"
    STANDUP = "standup"
