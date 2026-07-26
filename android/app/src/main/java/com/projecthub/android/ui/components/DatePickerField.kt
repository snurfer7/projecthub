package com.projecthub.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

private val isoFormatter = DateTimeFormatter.ISO_LOCAL_DATE

/**
 * Converts "yyyy-MM-dd" string to UTC millis at start of that day in local zone.
 */
private fun dateStringToMillis(s: String): Long? {
    if (s.isBlank()) return null
    return try {
        LocalDate.parse(s, isoFormatter)
            .atStartOfDay(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    } catch (_: DateTimeParseException) {
        null
    }
}

/**
 * Converts UTC millis to "yyyy-MM-dd" in local zone.
 */
private fun millisToDateString(millis: Long): String {
    return Instant.ofEpochMilli(millis)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .format(isoFormatter)
}

/**
 * 日付項目用のコンポーザブル。タップでシステム標準の DatePicker ダイアログを表示する。
 * [value] / [onValueChange] は "yyyy-MM-DD" 形式。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String = "YYYY-MM-DD",
    singleLine: Boolean = true,
    enabled: Boolean = true,
    supportingText: String? = null
) {
    var showPicker by remember { mutableStateOf(false) }

    OutlinedTextField(
        value = value,
        onValueChange = { },
        readOnly = true,
        enabled = enabled,
        label = { Text(label) },
        placeholder = { Text(placeholder) },
        supportingText = supportingText?.let { { Text(it) } },
        trailingIcon = {
            IconButton(onClick = { showPicker = true }, enabled = enabled) {
                Icon(
                    imageVector = Icons.Default.CalendarMonth,
                    contentDescription = "日付を選択"
                )
            }
        },
        modifier = modifier
            .fillMaxWidth()
            .clickable(
                enabled = enabled,
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) { showPicker = true },
        singleLine = singleLine
    )

    if (showPicker) {
        key(value) {
            val initialMillis = dateStringToMillis(value) ?: System.currentTimeMillis()
            val datePickerState = rememberDatePickerState(
                initialSelectedDateMillis = initialMillis,
                initialDisplayedMonthMillis = initialMillis
            )
            DatePickerDialog(
                onDismissRequest = { showPicker = false },
                confirmButton = {
                    TextButton(
                        onClick = {
                            datePickerState.selectedDateMillis?.let { millis ->
                                onValueChange(millisToDateString(millis))
                            }
                            showPicker = false
                        }
                    ) {
                        Text("OK")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showPicker = false }) {
                        Text("キャンセル")
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}
