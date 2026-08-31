from __future__ import annotations

import logging
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

log = logging.getLogger(__name__)

# Standard error messages across languages (FR, EN, AR)
ERROR_MESSAGES = {
    "AUTHENTICATION_FAILED": {
        "fr": "Identifiants invalides ou session expirée.",
        "en": "Invalid credentials or session expired.",
        "ar": "بيانات الاعتماد غير صالحة أو انتهت صلاحية الجلسة.",
    },
    "PERMISSION_DENIED": {
        "fr": "Vous n'avez pas l'autorisation d'effectuer cette action.",
        "en": "You do not have permission to perform this action.",
        "ar": "ليس لديك الصلاحية لتنفيذ هذا الإجراء.",
    },
    "NOT_FOUND": {
        "fr": "La ressource demandée est introuvable.",
        "en": "The requested resource was not found.",
        "ar": "المورد المطلوب غير موجود.",
    },
    "VALIDATION_ERROR": {
        "fr": "Les données envoyées sont invalides.",
        "en": "The submitted data is invalid.",
        "ar": "البيانات المرسلة غير صحيحة.",
    },
    "SERVER_ERROR": {
        "fr": "Une erreur interne est survenue sur le serveur.",
        "en": "An internal server error occurred.",
        "ar": "حدث خطأ داخلي في الخادم.",
    },
}


def _detect_lang(request) -> str:
    if not request:
        return "fr"
    if hasattr(request, "query_params"):
        if lang := request.query_params.get("lang"):
            if lang in ("fr", "en", "ar"):
                return lang
    accept = ""
    if hasattr(request, "headers"):
        accept = request.headers.get("Accept-Language", "").lower()
    elif hasattr(request, "META"):
        accept = request.META.get("HTTP_ACCEPT_LANGUAGE", "").lower()

    if "ar" in accept:
        return "ar"
    if "en" in accept:
        return "en"
    return "fr"


def custom_exception_handler(exc, context):
    """Custom DRF Exception Handler providing enterprise-grade standardized JSON errors."""
    response = exception_handler(exc, context)
    request = context.get("request")
    lang = _detect_lang(request)

    if response is None:
        log.exception("Unhandled server exception: %s", exc)
        return Response(
            {
                "error": {
                    "code": "SERVER_ERROR",
                    "message": ERROR_MESSAGES["SERVER_ERROR"].get(
                        lang, ERROR_MESSAGES["SERVER_ERROR"]["fr"]
                    ),
                    "details": str(exc) if getattr(request, "user", None) and request.user.is_staff else None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = "API_ERROR"
    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        code = "AUTHENTICATION_FAILED"
    elif isinstance(exc, PermissionDenied):
        code = "PERMISSION_DENIED"
    elif isinstance(exc, Http404):
        code = "NOT_FOUND"
    elif isinstance(exc, ValidationError):
        code = "VALIDATION_ERROR"

    default_msg = ERROR_MESSAGES.get(code, {}).get(lang, "Une erreur est survenue.")
    details = response.data
    message = default_msg

    if isinstance(details, dict) and "detail" in details:
        message = str(details["detail"])
    elif isinstance(details, list) and len(details) > 0:
        message = str(details[0])

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        }
    }

    return response
