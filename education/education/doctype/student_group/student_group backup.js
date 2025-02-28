frappe.ui.form.on('Student Group', {
  onload: function (frm) {
    frm.set_query('academic_term', function () {
      return {
        filters: {
          academic_year: frm.doc.academic_year,
        },
      }
    })
    if (!frm.__islocal) {
      frm.set_query('student', 'students', function () {
        let filters = {
          group_based_on: frm.doc.group_based_on,
        }

        if (!(frm.doc.group_based_on === 'Activity')) {
          filters = {
            ...filters,
            academic_year: frm.doc.academic_year,
            academic_term: frm.doc.academic_term,
            program: frm.doc.program,
            batch: frm.doc.batch,
            student_category: frm.doc.student_category,
            course: frm.doc.course,
            student_group: frm.doc.name,
          }
        }

        return {
          query:
            'education.education.doctype.student_group.student_group.fetch_students',
          filters: filters,
        }
      })
    }

    const iframe = `<iframe src="/app/m365-groups/${frm.doc.m365_group}" style="width: 100%; height: 600px; border: none;"></iframe>`;
    frm.fields_dict.m365_group_iframe.$wrapper.html(iframe);
  },

  refresh: function (frm) {
	office_365_logo = `<img src="/assets/frappe/icons/social/office_365.svg" alt="Office 365">`;
	frm.add_custom_button(__(`${frm.doc.m365_group ? "Sync ": "Create "}`+ `M365 Group and Teams ${office_365_logo}`), function () {
		if (frm.is_dirty()) {
			frappe.msgprint("Please save the form first.")
		} else {

			// frappe.call({
			// 	method: "frappe_m365.frappe_m365.doctype.m365_groups.m365_groups.create_m365_group_for_any_doc",
			// 	freeze: 1,
			// 	freeze_message: "<h4>Please wait while we are creating M365 Group...</h4>",
			// 	args:{
			// 		doc: frm.doc
			// 	},
			// 	callback: function (r) {
			// 		// frm.reload_doc();
			// 	}
			// });
			if (!frm.doc.m365_group){
				let dialog = new frappe.ui.Dialog({
				title: 'Create M365 Group and Teams',
				fields: [
					{
					fieldname: 'name',
					label: `Name (Leave blank to use Student Group's name)`,
					fieldtype: 'Data',
					reqd: 0
					},
					{
					fieldname: 'template',
					label: 'Template',
					fieldtype: 'Select',
					options: "standard\neducationClass",
					reqd: 1
					}
				],
				primary_action_label: 'Xác nhận',
				primary_action: function(values) {
					// Xử lý khi nhấn nút "Xác nhận"
					console.log("Giá trị nhận được:", values);
					frappe.call({
						method: "frappe_m365.frappe_m365.doctype.m365_groups.m365_groups.create_m365_group_for_any_doc",
						freeze: 1,
						freeze_message: "<h4>Please wait while we are creating M365 Group...</h4>",
						args:{
							doc: frm.doc,
							name: values.name,
							template: values.template,
							create_team:true
						},
						callback: function (r) {
							// frm.reload_doc();
						}
					});
					
					dialog.hide();
				},
				secondary_action_label: 'Từ chối',
				secondary_action: function() {
					// Xử lý khi nhấn nút "Từ chối"
					dialog.hide();
				}
				});
				
				// Hiển thị dialog
				dialog.show();
			}else{
				frappe.call({
					method: "frappe_m365.frappe_m365.doctype.m365_groups.m365_groups.create_m365_group_for_any_doc",
					freeze: 1,
					freeze_message: "<h4>Please wait while we are creating M365 Group...</h4>",
					args:{
						doc: frm.doc,
						name: values.name,
						template: values.template,
						create_team:true
					},
					callback: function (r) {
						frm.reload_doc();
					}
				});
			}

		}
	});

	frm.trigger("get_seperated_members");

    if (!frm.doc.__islocal) {
      frm.add_custom_button(
        __('Add Guardians to Email Group'),
        function () {
          frappe.call({
            method: 'education.education.api.update_email_group',
            args: {
              doctype: 'Student Group',
              name: frm.doc.name,
            },
          })
        },
        __('Actions')
      )

      frm.add_custom_button(
        __('Student Attendance Tool'),
        function () {
          frappe.route_options = {
            based_on: 'Student Group',
            student_group: frm.doc.name,
          }
          frappe.set_route(
            'Form',
            'Student Attendance Tool',
            'Student Attendance Tool'
          )
        },
        __('Tools')
      )

      frm.add_custom_button(
        __('Course Scheduling Tool'),
        function () {
          frappe.route_options = {
            student_group: frm.doc.name,
          }
          frappe.set_route(
            'Form',
            'Course Scheduling Tool',
            'Course Scheduling Tool'
          )
        },
        __('Tools')
      )

      frm.add_custom_button(
        __('Newsletter'),
        function () {
          frappe.route_options = {
            'Newsletter Email Group.email_group': frm.doc.name,
          }
          frappe.set_route('List', 'Newsletter')
        },
        __('View')
      )
    }
  },



  group_based_on: function (frm) {
    if (frm.doc.group_based_on == 'Batch') {
      frm.doc.course = null
      frm.set_df_property('program', 'reqd', 1)
      frm.set_df_property('course', 'reqd', 0)
    } else if (frm.doc.group_based_on == 'Course') {
      frm.set_df_property('program', 'reqd', 0)
      frm.set_df_property('course', 'reqd', 1)
    } else if (frm.doc.group_based_on == 'Activity') {
      frm.set_df_property('program', 'reqd', 0)
      frm.set_df_property('course', 'reqd', 0)
    }
  },

  get_students: function (frm) {
    if (
      frm.doc.group_based_on == 'Batch' ||
      frm.doc.group_based_on == 'Course'
    ) {
      var student_list = []
      var max_roll_no = 0
      $.each(frm.doc.students, function (_i, d) {
        student_list.push(d.student)
        if (d.group_roll_number > max_roll_no) {
          max_roll_no = d.group_roll_number
        }
      })

      if (frm.doc.academic_year) {
        frappe.call({
          method:
            'education.education.doctype.student_group.student_group.get_students',
          args: {
            academic_year: frm.doc.academic_year,
            academic_term: frm.doc.academic_term,
            group_based_on: frm.doc.group_based_on,
            program: frm.doc.program,
            batch: frm.doc.batch,
            student_category: frm.doc.student_category,
            course: frm.doc.course,
          },
          callback: function (r) {
            if (r.message) {
              $.each(r.message, function (i, d) {
                if (!in_list(student_list, d.student)) {
                  var s = frm.add_child('students')
                  s.student = d.student
                  s.student_name = d.student_name
                  if (d.active === 0) {
                    s.active = 0
                  }
                  s.group_roll_number = ++max_roll_no
                }
              })
              refresh_field('students')
              frm.save()
            } else {
              frappe.msgprint(__('Student Group is already updated.'))
            }
          },
        })
      }
    } else {
      frappe.msgprint(
        __('Select students manually for the Activity based Group')
      )
    }
  },
  
  get_seperated_members: function (frm){

		add_erpnext_member_to_m365 = (user_id) => {
			frappe.call({
				method: "add_erpnext_member_to_m365",
				freeze: 1,
				freeze_message: "<h4>Please wait while we do the action.../h4>",
				doc: frm.doc,
				args:{
					user_id:user_id
				},
				callback: function (response) {
					console.log(response.message);
					frappe.msgprint(` ${JSON.stringify(response.message)} `);
					frm.reload_doc();
				}
			});
		}

		unlink_from_student_group = (student_name) => {
			frappe.call({
				method: "unlink_student_student_group",
				freeze: 1,
				freeze_message: "<h4>Please wait while we do the action.../h4>",
				doc: frm.doc,
				args:{
					student_name:student_name
				},
				callback: function (response) {
					frappe.msgprint(` ${JSON.stringify(response.message)} `);
					frm.reload_doc();
				}
			});

		}

		add_m365_member_to_erpnext = (email,full_name) => {
			frappe.call({
				method: "add_student_to_student_group",
				freeze: 1,
				freeze_message: "<h4>Please wait while we do the action.../h4>",
				doc: frm.doc,
				args:{
					email:email,
					full_name:full_name
				},
				callback: function (response) {
					frm.reload_doc();
				}
			});
		}

		remove_member_from_m365 = (email) => {
			frappe.call({
				method: "remove_member_from_m365",
				freeze: 1,
				freeze_message: "<h4>Please wait while we do the action.../h4>",
				doc: frm.doc,
				args:{
					email:email
				},
				callback: function (response) {
					console.log(response.message);
					frappe.msgprint(` ${JSON.stringify(response.message)} `);
					frm.reload_doc();
				}
			});
		}


		frappe.call({
			method: "get_seperated_members",
			freeze: 0,
			freeze_message: "<h4>Please wait while we get Members on M365 group...</h4>",
			doc: frm.doc,
			callback: function (response) {
				console.log(response.message);
				console.log(JSON.stringify(response.message));
				const data = response.message;

				// Tạo bảng HTML
				let erpnext_only_table_html = `
					<table class="table table-bordered">
						<thead>
							<tr>
								<th>Student ID(Doc Name)</th>
								<th>Name</th>
								<th>Email</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
				`;

				// Đổ dữ liệu vào bảng
				data.only_in_erpnext.forEach(student => {
					erpnext_only_table_html += `
						<tr>
							<td><a href="/app/student/${student.name}">${student.name}</td>
							<td>${student.student_name}</td>
							<td>${student.student_email_id}</td>
							<td><button onclick = "add_erpnext_member_to_m365('${student.student_email_id}')" class = "btn btn-default">Add to M365</button>
							<br><br><button onclick = "unlink_from_student_group('${student.name}')" class = "btn btn-default">Unlink from this Student Group</button>					
						</tr>
					`;
					// <br><br><button onclick = "add_member_to_m365_via_power_automate('${student.name}')" class = "btn btn-primary">Add to M365 via Power Automate</button></td>
				});

				erpnext_only_table_html += `
						</tbody>
					</table>
				`;

				// Đưa bảng HTML vào trường HTML Field
				frm.fields_dict['erpnext_only_table_html'].$wrapper.html(erpnext_only_table_html);

				let m365_only_members_table_html = `
					<table class="table table-bordered">
						<thead>
							<tr>
								<th>Office 365 ID</th>
								<th>Name</th>
								<th>Email</th>
								<th>Actions</th>
								
							</tr>
						</thead>
						<tbody>
				`;

				// Đổ dữ liệu vào bảng
				data.only_in_m365.forEach(member => {
					m365_only_members_table_html += `
						<tr>
							<td>${member.id}</td>
							<td>${member.displayName}</td>
							<td>${member.mail}</td>
							<td><button onclick = "add_m365_member_to_erpnext('${member.mail}','${member.displayName}')" class = "btn btn-default">Add to this Student Group</button>
							<br>
							<br><button onclick = "remove_member_from_m365('${member.mail}')" class = "btn btn-default">Remove from M365 Group</button></td>
						</tr>
					`;
				});

				m365_only_members_table_html += `
						</tbody>
					</table>
				`;

				// Đưa bảng HTML vào trường HTML Field
				frm.fields_dict['m365_only_members_table_html'].$wrapper.html(m365_only_members_table_html);

				let both_table_html = `
					<table class="table table-bordered">
						<thead>
							<tr>
								<th>Student ID(Doc Name)</th>
								<th>Office 365 ID</th>
								<th>Name</th>
								<th>Office Name</th>
								<th>Email</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
				`;

				// Đổ dữ liệu vào bảng
				data.both.forEach(student => {
					both_table_html += `
						<tr>
							<td><a href="/app/student/${student.name}">${student.name}</td>
							<td>${student.office_365_id}</td>
							<td>${student.student_name}</td>
							<td>${student.user_id}</td>
							<td>${student.student_email_id}</td>
							<td><button onclick = "unlink_from_student_group('${student.name}')" class = "btn btn-default">Unlink from this Student Group</button>
							<br><br><button onclick = "remove_member_from_m365('${student.user_id}')" class = "btn btn-default">Remove from M365 Group</button></td>
						</tr>
					`;
				});

				both_table_html += `
						</tbody>
					</table>
				`;

				// Đưa bảng HTML vào trường HTML Field
				frm.fields_dict['both_table_html'].$wrapper.html(both_table_html);
			}
		});
	}
})

frappe.ui.form.on('Student Group Instructor', {
  instructors_add: function (frm) {
    frm.fields_dict['instructors'].grid.get_field('instructor').get_query =
      function (doc) {
        let instructor_list = []
        $.each(doc.instructors, function (idx, val) {
          instructor_list.push(val.instructor)
        })
        return { filters: [['Instructor', 'name', 'not in', instructor_list]] }
      }
  },
})
