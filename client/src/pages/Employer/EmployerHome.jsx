import { useEffect, useState } from 'react';

import { api } from '../../services/api';

import { fmtDeadline } from '../../utils/jobUtils';

import JobDetailModal, { JobPreviewCard } from '../../components/jobs/JobDetailModal';

import '../../components/Layout/EmployerLayout.css';



export default function EmployerHome() {

  const [jobs, setJobs] = useState([]);

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);

  const [pages, setPages] = useState(1);

  const [selected, setSelected] = useState(null);



  useEffect(() => {

    let cancelled = false;

    setLoading(true);

    api.getEmployerJobFeed({ page, limit: 8 })

      .then((data) => {

        if (cancelled) return;

        setJobs(data.jobs || []);

        setPages(data.pages || 1);

      })

      .catch(() => { if (!cancelled) setJobs([]); })

      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };

  }, [page]);



  return (

    <>

      <header className="emp-page-header">

        <h1>Home</h1>

        <p>Browse open roles from other verified organizations on OPUS</p>

      </header>



      {loading ? (

        <div className="emp-empty">Loading jobs…</div>

      ) : jobs.length === 0 ? (

        <div className="emp-empty">No published jobs yet. Check back when other employers post roles.</div>

      ) : (

        <>

          <div className="emp-job-grid emp-job-grid--cards">

            {jobs.map((job) => (

              <article key={job.id} className="emp-job-card-wrap">

                <JobPreviewCard job={job} onClick={() => setSelected(job)} />

                <p className="emp-job-card-foot">

                  {job.location}

                  {job.applicationDeadline && ` · Closes ${fmtDeadline(job.applicationDeadline)}`}

                </p>

              </article>

            ))}

          </div>

          {pages > 1 && (

            <div className="emp-filter-bar" style={{ marginTop: 20 }}>

              <button type="button" className="emp-btn emp-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>

              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Page {page} of {pages}</span>

              <button type="button" className="emp-btn emp-btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>

            </div>

          )}

        </>

      )}



      {selected && (

        <JobDetailModal job={selected} onClose={() => setSelected(null)} showApply={false} />

      )}

    </>

  );

}

