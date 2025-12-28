import { Injectable } from '@nestjs/common';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { BulkNfcAssignmentDto, BulkNfcAssignmentItemDto } from '../dto/bulk-nfc-assignment.dto';

@Injectable()
export class CsvNfcParserService {
  /**
   * Parse CSV file for bulk NFC card assignment
   * Expected CSV format:
   * Registration Number,Student Name,NFC Card ID
   * REG-2025-0014,John Doe,NFC-ABC123XYZ456
   * REG-2025-0015,Jane Smith,GENERATE
   * REG-2025-0016,Bob Johnson,
   */
  async parseCsvFile(file: Express.Multer.File): Promise<BulkNfcAssignmentDto> {
    return new Promise((resolve, reject) => {
      const assignments: BulkNfcAssignmentItemDto[] = [];
      const stream = Readable.from(file.buffer.toString());

      stream
        .pipe(
          csvParser({
            headers: true,
          }),
        )
        .on('data', (row: any) => {
          // Skip empty rows
          if (!row || Object.keys(row).length === 0) {
            return;
          }

          // Support multiple column name variations
          const studentIdentifier =
            row['Registration Number'] ||
            row['registration_number'] ||
            row['RegistrationNumber'] ||
            row['Student ID'] ||
            row['student_id'] ||
            row['StudentID'] ||
            row['ID'] ||
            '';

          const nfcCardId =
            row['NFC Card ID'] ||
            row['nfc_card_id'] ||
            row['NFCCardID'] ||
            row['NFC Card'] ||
            row['Card ID'] ||
            row['card_id'] ||
            row['CardID'] ||
            '';

          if (studentIdentifier && studentIdentifier.trim()) {
            assignments.push({
              student_identifier: studentIdentifier.trim(),
              nfc_card_id: nfcCardId && nfcCardId.trim() ? nfcCardId.trim() : undefined,
            });
          }
        })
        .on('end', () => {
          resolve({ assignments });
        })
        .on('error', (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
    });
  }
}

