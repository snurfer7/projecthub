package com.projecthub.android.ui.utils

/**
 * Formats a postal code as 000-0000.
 * To be used during input (onValueChange).
 */
fun formatPostalCode(value: String): String {
    val digits = value.replace(Regex("\\D"), "")
    return if (digits.length > 3) {
        val first = digits.substring(0, 3)
        val second = digits.substring(3, minOf(digits.length, 7))
        "$first-$second"
    } else {
        digits
    }
}
