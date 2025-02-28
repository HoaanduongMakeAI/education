# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint

from education.education.utils import validate_duplicate_student


class StudentGroup(Document):
	def validate(self):
		self.validate_mandatory_fields()
		self.validate_strength()
		self.validate_students()
		self.validate_and_set_child_table_fields()
		validate_duplicate_student(self.students)

	def validate_mandatory_fields(self):
		if self.group_based_on == "Course" and not self.course:
			frappe.throw(_("Please select Course"))
		if self.group_based_on == "Course" and (not self.program and self.batch):
			frappe.throw(_("Please select Program"))
		if self.group_based_on == "Batch" and not self.program:
			frappe.throw(_("Please select Program"))

	def validate_strength(self):
		if cint(self.max_strength) < 0:
			frappe.throw(_("""Max strength cannot be less than zero."""))
		if self.max_strength and len(self.students) > self.max_strength:
			frappe.throw(
				_("""Cannot enroll more than {0} students for this student group.""").format(
					self.max_strength
				)
			)

	def validate_students(self):
		program_enrollment = get_program_enrollment(
			self.academic_year,
			self.academic_term,
			self.program,
			self.batch,
			self.student_category,
			self.course,
		)
		students = [d.student for d in program_enrollment] if program_enrollment else []
		for d in self.students:
			if (
				not frappe.db.get_value("Student", d.student, "enabled")
				and d.active
				and not self.disabled
			):
				frappe.throw(
					_("{0} - {1} is inactive student").format(d.group_roll_number, d.student_name)
				)

			if (
				(self.group_based_on == "Batch")
				and cint(frappe.defaults.get_defaults().validate_batch)
				and d.student not in students
			):
				frappe.throw(
					_("{0} - {1} is not enrolled in the Batch {2}").format(
						d.group_roll_number, d.student_name, self.batch
					)
				)

			if (
				(self.group_based_on == "Course")
				and cint(frappe.defaults.get_defaults().validate_course)
				and (d.student not in students)
			):
				frappe.throw(
					_("{0} - {1} is not enrolled in the Course {2}").format(
						d.group_roll_number, d.student_name, self.course
					)
				)

	def validate_and_set_child_table_fields(self):
		roll_numbers = [d.group_roll_number for d in self.students if d.group_roll_number]
		max_roll_no = max(roll_numbers) if roll_numbers else 0
		roll_no_list = []
		for d in self.students:
			if not d.student_name:
				d.student_name = frappe.db.get_value("Student", d.student, "title")
			if not d.group_roll_number:
				max_roll_no += 1
				d.group_roll_number = max_roll_no
			if d.group_roll_number in roll_no_list:
				frappe.throw(_("Duplicate roll number for student {0}").format(d.student_name))
			else:
				roll_no_list.append(d.group_roll_number)
	
	@frappe.whitelist(methods=["GET"])
	def get_employees(self):
		employees = frappe.get_all(
			'Employee',
			filters={'department': self.name},
			fields=['name', 'employee_name', 'designation', 'department','user_id']
		)
		# frappe.msgprint(str(self))
		# frappe.msgprint(str(employees))
		return employees

	@frappe.whitelist()
	def get_m365_members_on_server(self):
		if self.m365_group:
			m365_group = frappe.get_doc("M365 Groups",self.m365_group)
			return m365_group.get_m365_members_on_server()
		else:
			return []

	@frappe.whitelist()
	def get_seperated_members(self):

		erpnext_members = self.students
		students_list = []
		for s in erpnext_members:
			student = frappe.get_doc("Student", s.student).as_dict()
			student["user_id"] = student["student_email_id"]
			students_list.append(student)

		erpnext_members = students_list
		m365_members = self.get_m365_members_on_server()

		erpnext_emails = {member["student_email_id"] for member in erpnext_members}
		m365_lookup = {member["mail"]: member for member in m365_members}

		# Lọc ra các thành viên chỉ có trong ERPNext
		only_in_erpnext = [member for member in erpnext_members if member["student_email_id"] not in m365_lookup]

		# Lọc ra các thành viên chỉ có trong M365
		only_in_m365 = [member for member in m365_members if member["mail"] not in erpnext_emails]

		# both = [member for member in erpnext_members if member["user_id"] in m365_emails]

		both = [
			{
				**erp_member,  # Toàn bộ thuộc tính từ erpnext_members
				"office_365_id": m365_lookup[erp_member["student_email_id"]]["id"],  # Thuộc tính mới
				"office_365_name": m365_lookup[erp_member["student_email_id"]]["displayName"],  # Thuộc tính mới
			}
			for erp_member in erpnext_members
			if erp_member["student_email_id"] in m365_lookup  # Chỉ thêm nếu có trong m365_lookup
		]
		

		# frappe.msgprint(str({"only_in_erpnext":only_in_erpnext,"only_in_m365":only_in_m365}))

		return {"only_in_erpnext":only_in_erpnext,"only_in_m365":only_in_m365,"both":both}

	@frappe.whitelist()
	def add_erpnext_member_to_m365(self,user_id):
		if(self.m365_group):
			m365_group = frappe.get_doc("M365 Groups",self.m365_group)
			return m365_group.add_user_to_m365(user_id)
		else:
			frappe.throw("This Department doesn't have a M365 Group. Please create M365 Group for This Department.")

	@frappe.whitelist()
	def add_member_to_m365_via_power_automate(self,user_id):
		if(self.m365_group):
			m365_group = frappe.get_doc("M365 Groups",self.m365_group)
			return m365_group.add_member_to_m365_via_power_automate(user_id)
		else:
			frappe.throw("This Department doesn't have a M365 Group. Please create M365 Group for This Department.")

	@frappe.whitelist()
	def remove_member_from_m365(self,email):
		if(self.m365_group):
			m365_group = frappe.get_doc("M365 Groups",self.m365_group)
			return m365_group.remove_member_from_m365(email)
		else:
			frappe.throw("This Department doesn't have a M365 Group. Please create M365 Group for This Department.")
	@frappe.whitelist()
	def add_student_to_student_group(self, email, full_name):
		# 1. Tạo User
		if not frappe.db.exists("User", email):
			user = frappe.get_doc({
				"doctype": "User",
				"email": email,
				"first_name": full_name,
				"enabled": 1,
				"send_welcome_email": 0  # Không gửi email chào mừng nếu không cần
			})
			user.insert()
		student = frappe.db.get_value("Student", {"student_email_id": email}, "name")
		if not student:
			student = frappe.get_doc({
				"doctype": "Student",
				"student_email_id": email,
				"first_name": full_name,
				"user": email,
				"enabled": 1
			})
			student.insert()
			student = student.name

		self.append("students", {
			"student": student  # Thay bằng ID của Student đã có
		})
		self.save()
		frappe.db.commit()

		return "Student added to this Student Group"
	
	@frappe.whitelist()
	def unlink_student_student_group(self,student_name):
		for row in self.students:
			if row.student == student_name:
				self.get("students").remove(row)
				self.save()
				frappe.db.commit()
				break
		# frappe.msgprint(student_name)
		return "Student unlinked from this Student Group"

@frappe.whitelist()
def get_students(
	academic_year,
	group_based_on,
	academic_term=None,
	program=None,
	batch=None,
	student_category=None,
	course=None,
):
	enrolled_students = get_program_enrollment(
		academic_year, academic_term, program, batch, student_category, course
	)

	if enrolled_students:
		student_list = []
		for s in enrolled_students:
			if frappe.db.get_value("Student", s.student, "enabled"):
				s.update({"active": 1})
			else:
				s.update({"active": 0})
			student_list.append(s)
		return student_list
	else:
		frappe.msgprint(_("No students found"))
		return []


def get_program_enrollment(
	academic_year,
	academic_term=None,
	program=None,
	batch=None,
	student_category=None,
	course=None,
):

	condition1 = " "
	condition2 = " "
	if academic_term:
		condition1 += " and pe.academic_term = %(academic_term)s"
	if program:
		condition1 += " and pe.program = %(program)s"
	if batch:
		condition1 += " and pe.student_batch_name = %(batch)s"
	if student_category:
		condition1 += " and pe.student_category = %(student_category)s"
	if course:
		condition1 += " and pe.name = pec.parent and pec.course = %(course)s"
		condition2 = ", `tabProgram Enrollment Course` pec"

	return frappe.db.sql(
		"""
		select
			pe.student, pe.student_name
		from
			`tabProgram Enrollment` pe {condition2}
		where
			pe.academic_year = %(academic_year)s
			and pe.docstatus = 1 {condition1}
		order by
			pe.student_name asc
		""".format(
			condition1=condition1, condition2=condition2
		),
		(
			{
				"academic_year": academic_year,
				"academic_term": academic_term,
				"program": program,
				"batch": batch,
				"student_category": student_category,
				"course": course,
			}
		),
		as_dict=1,
	)


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def fetch_students(doctype, txt, searchfield, start, page_len, filters):
	if filters.get("group_based_on") != "Activity":
		enrolled_students = get_program_enrollment(
			filters.get("academic_year"),
			filters.get("academic_term"),
			filters.get("program"),
			filters.get("batch"),
			filters.get("student_category"),
		)
		student_group_student = frappe.db.sql_list(
			"""select student from `tabStudent Group Student` where parent=%s""",
			(filters.get("student_group")),
		)
		students = (
			[d.student for d in enrolled_students if d.student not in student_group_student]
			if enrolled_students
			else [""]
		) or [""]
		return frappe.db.sql(
			"""select name, student_name from tabStudent
			where name in ({0}) and (`{1}` LIKE %s or student_name LIKE %s)
			order by idx desc, name
			limit %s, %s""".format(
				", ".join(["%s"] * len(students)), searchfield
			),
			tuple(students + ["%%%s%%" % txt, "%%%s%%" % txt, start, page_len]),
		)
	else:
		return frappe.db.sql(
			"""select name, student_name from tabStudent
			where `{0}` LIKE %s or student_name LIKE %s
			order by idx desc, name
			limit %s, %s""".format(
				searchfield
			),
			tuple(["%%%s%%" % txt, "%%%s%%" % txt, start, page_len]),
		)
	
